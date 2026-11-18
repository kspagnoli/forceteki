import type { IModelPrompt } from './ModelPrompt';
import type { Game } from '../Game';
import type { Card } from '../card/Card';
import type { Player } from '../Player';
import { EventName, ZoneName } from '../Constants';

interface IPlayFact {
    actorId: string;
    cardKey: string | null;
    instanceId: string | null;
    orderWithinPhase: number;
}

interface IMemoryFact {
    cardKey: string;
    ownerId: string;
    zone: string;
    certainty: 'historical';
    copiesLowerBound: number;
    seenRound: number;
}

/** Opt-in observer. It never changes rules, randomness, prompt state or card visibility. */
export class ModelContext {
    private attempts = new Map<string, { total: number; entries: {
        source: IModelPrompt['source']; abilityKey?: string; cancelled: boolean;
    }[]; }>();

    private plays = new Map<string, IPlayFact[]>();
    private memories = new Map<string, Map<string, IMemoryFact>>();
    private knownTops = new Map<string, Map<string, { cardKey: string; deckRevision: number; seenRound: number }>>();
    private lastAction: { actorId: string; kind: string } | null = null;
    private claimActor: string | null = null;

    public constructor(private readonly game: Game, private readonly orderedDeckMemory: boolean | string[] = false) {
        this.orderedDeckMemory = Array.isArray(orderedDeckMemory) ? [...orderedDeckMemory] : orderedDeckMemory;
        for (const player of game.getPlayers()) {
            this.attempts.set(player.id, { total: 0, entries: [] });
            this.knownTops.set(player.id, new Map());
            this.plays.set(player.id, []);
            this.memories.set(player.id, new Map());
        }
        game.on(EventName.OnPhaseStarted, () => {
            for (const plays of this.plays.values()) {
                plays.length = 0;
            }
            this.clearActionAttempts();
            this.lastAction = null;
            this.claimActor = null;
        });
        game.on(EventName.OnCardPlayed, (event) => {
            for (const viewer of game.getPlayers()) {
                const summary = event.card.getSummary(viewer);
                const plays = this.plays.get(viewer.id);
                plays.push({ actorId: event.player.id, cardKey: summary?.id ?? null,
                    instanceId: summary?.id ? event.card.uuid : null, orderWithinPhase: plays.length + 1 });
            }
        });
        game.on(EventName.OnClaimInitiative, (event) => this.claimActor = event.player.id);
        game.on(EventName.OnActionTaken, (event) => {
            this.clearActionAttempts();
            const kind = this.claimActor === event.player.id ? 'claim_initiative'
                : game.prevActionPhasePlayerPassed ? 'pass' : 'other';
            this.lastAction = kind === 'other' ? null : { actorId: event.player.id, kind };
            this.claimActor = null;
        });
        game.on(EventName.OnLookAtCard, (event) => {
            if (event.modelViewingPlayerId) {
                this.remember(event.modelViewingPlayerId, event.cards);
            }
        });
        game.on(EventName.OnCardRevealed, (event) => {
            for (const player of game.getPlayers()) {
                this.remember(player.id, event.cards);
            }
        });
    }

    private clearActionAttempts(): void {
        for (const attempts of this.attempts.values()) {
            attempts.total = 0;
            attempts.entries.length = 0;
        }
    }

    /** Private, uncommitted action attempts in this action window; bounded storage has explicit omission counts. */
    public recordActionAttempt(playerId: string, source: IModelPrompt['source'], abilityKey: string | undefined,
        cancelled: boolean, resolutionCommitted: boolean): void {
        if (resolutionCommitted) {
            return;
        }
        const attempts = this.attempts.get(playerId);
        attempts.total++;
        attempts.entries.push({ source, abilityKey, cancelled });
        if (attempts.entries.length > 32) {
            attempts.entries.shift();
        }
    }

    private remember(viewerId: string, cards: Card[] = [], zoneOverride?: string) {
        const memory = this.memories.get(viewerId);
        if (!memory) {
            return;
        }
        const batch = new Map<string, IMemoryFact>();
        const seenInstances = new Set<string>();
        for (const card of cards) {
            if (seenInstances.has(card.uuid)) {
                continue;
            }
            seenInstances.add(card.uuid);
            // Only this explicit view/reveal event grants access to these identities.
            const zone = zoneOverride ?? card.zoneName;
            const key = `${card.owner.id}:${card.id}:${zone}`;
            const existing = batch.get(key);
            if (existing) {
                existing.copiesLowerBound++;
            } else {
                batch.set(key, { cardKey: card.id, ownerId: card.owner.id, zone,
                    certainty: 'historical', copiesLowerBound: 1, seenRound: this.game.roundNumber });
            }
        }
        for (const [key, fact] of batch) {
            // Repeated views do not imply additional copies of an unseen physical card.
            const previous = memory.get(key);
            if (previous && previous.copiesLowerBound > fact.copiesLowerBound) {
                fact.copiesLowerBound = previous.copiesLowerBound;
                fact.seenRound = previous.seenRound;
            }
            memory.set(key, fact);
        }
    }

    public usesOrderedDeckMemory(viewerId: string): boolean {
        return this.orderedDeckMemory === true || (Array.isArray(this.orderedDeckMemory) && this.orderedDeckMemory.includes(viewerId));
    }

    /** Only an effect that explicitly exposes the top position may call this. No deck identities are inspected here. */
    public recordKnownDeckTop(viewerId: string, card: Card): void {
        if (!this.usesOrderedDeckMemory(viewerId) || !this.knownTops.has(viewerId) || card.zoneName !== ZoneName.Deck) {
            return;
        }
        this.remember(viewerId, [card]);
        this.knownTops.get(viewerId).set(card.owner.id, {
            cardKey: card.id, deckRevision: card.owner.deckZone.modelKnowledgeRevision, seenRound: this.game.roundNumber
        });
    }

    /** A display prompt itself grants these identities to its recipient. */
    public recordDisplay(viewer: Player, cards: Card[]): void {
        this.remember(viewer.id, cards, 'display');
    }

    public snapshot(viewer: Player, visibleIds: Set<string>) {
        const attempts = this.attempts.get(viewer.id);
        return {
            actionAttempts: {
                scope: 'current_action_window' as const,
                total: attempts.total,
                omitted: attempts.total - attempts.entries.length,
                entries: attempts.entries.map((attempt) => ({ ...attempt,
                    source: attempt.source ? { ...attempt.source,
                        instanceId: visibleIds.has(attempt.source.instanceId) ? attempt.source.instanceId : null } : null }))
            },
            phasePlaysComplete: true,
            abilityUsesComplete: false,
            memoryCompleteness: 'partial',
            phasePlays: this.plays.get(viewer.id).map((play) => ({ ...play,
                instanceId: play.instanceId && visibleIds.has(play.instanceId) ? play.instanceId : null })),
            abilityUses: [],
            lastAction: this.lastAction ? { ...this.lastAction } : null,
            rememberedCards: [...this.memories.get(viewer.id).values()].map((fact) => {
                const top = this.knownTops.get(viewer.id).get(fact.ownerId);
                const current = fact.zone === ZoneName.Deck && top?.cardKey === fact.cardKey &&
                  top.deckRevision === this.game.getPlayerById(fact.ownerId).deckZone.modelKnowledgeRevision;
                return {
                    cardKey: fact.cardKey, ownerId: fact.ownerId, zone: fact.zone,
                    certainty: current ? 'current' : fact.certainty,
                    position: current ? { end: 'top', offset: 0 } : null,
                    copiesLowerBound: current ? 1 : fact.copiesLowerBound,
                    ageRounds: Math.max(0, this.game.roundNumber - (current ? top.seenRound : fact.seenRound))
                };
            })
        };
    }
}
