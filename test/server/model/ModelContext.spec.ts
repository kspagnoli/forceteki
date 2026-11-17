import { EventEmitter } from 'events';
import { ModelContext } from '../../../server/game/core/model/ModelContext';
import { EventName } from '../../../server/game/core/Constants';
import type { Game } from '../../../server/game/core/Game';
import type { Card } from '../../../server/game/core/card/Card';
import type { Player } from '../../../server/game/core/Player';

function fixture() {
    const players = [{ id: 'one' }, { id: 'two' }] as Player[];
    const game = Object.assign(new EventEmitter(), { roundNumber: 1, prevActionPhasePlayerPassed: false, getPlayers: () => players });
    const ledger = new ModelContext(game as unknown as Game);
    const card = { id: 'public-card', uuid: 'physical-card', owner: players[1], zoneName: 'hand',
        getSummary: (viewer: Player) => (viewer === players[0] ? { id: 'public-card', uuid: 'physical-card' } : {}) } as unknown as Card;
    return { game, ledger, players, card };
}

describe('Opt-in model observation ledger', () => {
    it('keeps a private look only in its explicitly named recipient seat', () => {
        const { game, ledger, players, card } = fixture();
        game.emit(EventName.OnLookAtCard, { modelViewingPlayerId: 'one', cards: [card, card] });
        expect(ledger.snapshot(players[0], new Set()).rememberedCards.length).toBe(1);
        expect(ledger.snapshot(players[0], new Set()).rememberedCards[0].copiesLowerBound).toBe(1);
        expect(ledger.snapshot(players[1], new Set()).rememberedCards.length).toBe(0);
        expect(ledger.snapshot(players[0], new Set()).rememberedCards[0].certainty).toBe('historical');
        expect(ledger.snapshot(players[0], new Set()).rememberedCards[0].position).toBeNull();
    });

    it('retains an explicit display grant only for its recipient without asserting a current position', () => {
        const { ledger, players, card } = fixture();
        ledger.recordDisplay(players[0], [card, card]);
        ledger.recordDisplay(players[0], [card]);
        const memory = ledger.snapshot(players[0], new Set()).rememberedCards;
        expect(memory[0].zone).toBe('display');
        expect(memory.length).toBe(1);
        expect(memory[0].copiesLowerBound).toBe(1);
        expect(memory[0].certainty).toBe('historical');
        expect(memory[0].position).toBeNull();
        expect(ledger.snapshot(players[1], new Set()).rememberedCards.length).toBe(0);
    });

    it('records public reveals for both seats without counting repeated views as new copies', () => {
        const { game, ledger, players, card } = fixture();
        game.emit(EventName.OnCardRevealed, { cards: [card, { ...card, uuid: 'second-copy' }] });
        game.roundNumber++;
        game.emit(EventName.OnCardRevealed, { cards: [card] });
        for (const player of players) {
            const memory = ledger.snapshot(player, new Set()).rememberedCards;
            expect(memory.length).toBe(1);
            expect(memory[0].copiesLowerBound).toBe(2);
            expect(memory[0].ageRounds).toBe(1);
        }
    });

    it('filters played identities per seat and never reconnects a historical card to a hidden instance', () => {
        const { game, ledger, players, card } = fixture();
        game.emit(EventName.OnCardPlayed, { card, player: players[0] });
        const visible = ledger.snapshot(players[0], new Set(['physical-card'])).phasePlays[0];
        expect(visible.cardKey).toBe('public-card');
        expect(visible.instanceId).toBe('physical-card');
        expect(ledger.snapshot(players[0], new Set()).phasePlays[0].instanceId).toBeNull();
        const hidden = ledger.snapshot(players[1], new Set(['physical-card'])).phasePlays[0];
        expect(hidden.cardKey).toBeNull();
        expect(hidden.instanceId).toBeNull();
    });

    it('clears phase facts while retaining historical reveals and distinguishing pass from claim', () => {
        const { game, ledger, players, card } = fixture();
        game.emit(EventName.OnCardPlayed, { card, player: players[0] });
        game.emit(EventName.OnLookAtCard, { modelViewingPlayerId: 'one', cards: [card] });
        game.prevActionPhasePlayerPassed = true;
        game.emit(EventName.OnActionTaken, { player: players[0] });
        expect(ledger.snapshot(players[0], new Set()).lastAction.kind).toBe('pass');
        game.emit(EventName.OnClaimInitiative, { player: players[1] });
        game.emit(EventName.OnActionTaken, { player: players[1] });
        expect(ledger.snapshot(players[0], new Set()).lastAction.kind).toBe('claim_initiative');
        game.emit(EventName.OnPhaseStarted, { phase: 'regroup' });
        const result = ledger.snapshot(players[0], new Set());
        expect(result.phasePlays.length).toBe(0);
        expect(result.lastAction).toBeNull();
        expect(result.rememberedCards.length).toBe(1);
        expect(result.abilityUsesComplete).toBe(false);
    });
});
