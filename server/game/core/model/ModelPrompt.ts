import type { PlayCardAction } from '../ability/PlayCardAction';
import type { TokenUpgradeName } from '../Constants';
import type { Player } from '../Player';
import type { PlayerOrCardAbility } from '../ability/PlayerOrCardAbility';
import type { Card } from '../card/Card';

/** Player-scoped, opt-in metadata. Never included in ordinary game-state payloads. */
export interface IModelOption {
    kind: string;
    command: string;
    args: unknown[];
    sourceId?: string;
    abilityOriginId?: string;
    targetId?: string;
    abilityKey?: string;
    optionKey?: string;
    number?: number;
    hasLegalEffects?: boolean;
    quantity?: number;
    costUnknown?: boolean;
}

export interface IModelPrompt {
    family: string;
    options: IModelOption[];
    abilityKey?: string;
    displayCards?: { id: string; uuid: string; ownerId: string; controllerId: string; zone: 'display' }[];
    selection?: {
        domain?: 'entities' | 'options';
        selectedOptionKeys?: string[];
        min: number;
        max: number | null;
        ordered: boolean;
        selectedIds: string[];
        canConfirm: boolean;
        canCancel: boolean;
        canDecline: boolean;
    };
    numberRange?: { min: number; max: number };
    distribution?: {
        kind: 'indirect_damage' | 'damage' | 'healing' | 'token_upgrade';
        tokenType: TokenUpgradeName | null;
        amount: number;
        canDistributeLess: boolean;
        canChooseNoTargets: boolean;
        maxTargets: number | null;
        targets: { id: string; maximum: number }[];
    };
    rootActorId?: string;
    source?: { cardKey: string; instanceId: string | null };
}

export interface IModelSelectionBounds {
    min: number;
    max: number | null;
}

/** A source is identified only through the same visibility filter as the player's board. */
export function modelSource(source: Card | unknown, player: Player): IModelPrompt['source'] {
    if (!source || typeof (source as Card).getSummary !== 'function') {
        return undefined;
    }
    const summary = (source as Card).getSummary(player);
    return summary?.id ? { cardKey: summary.id, instanceId: summary.uuid ?? null } : undefined;
}

/** Stable rules identifiers, scoped by the pinned engine; never titles or instance IDs. */
export function modelAbilityKey(ability: PlayerOrCardAbility, player: Player): string | undefined {
    if (!ability || !modelSource(ability.card, player)) {
        return undefined;
    }
    if (ability.isAttackAction()) {
        return 'action.attack';
    }
    if (ability.isPlayCardAbility()) {
        return modelPlayAbilityKey(ability, player);
    }
    // This metadata is set only by the keyword registrar, including when a keyword is gained.
    if (ability.isCardAbilityStep() && ['ambush', 'shielded', 'saboteur'].includes(ability.modelKeyword)) {
        return `keyword.${ability.modelKeyword}`;
    }
    if (ability.isCardAbilityStep()) {
        const origin = ability.modelAbilityOrigin;
        if (origin) {
            const identifier = ability.modelIdentifier ?? ability.stepIdentifier;
            if (!modelSource(origin, player) ||
              (!identifier.startsWith(`${origin.internalName}_`) && !identifier.startsWith(`gained_from_${origin.internalName}_`))) {
                return undefined;
            }
        } else if ((ability.isCardAbility() && !ability.printedAbility) || ability.stepIdentifier.startsWith('gained_from_')) {
            return undefined;
        }
    }
    if (ability.isCardAbility() && ability.printedAbility && ability.card.isBase() && ability.isEpicAction) {
        return `ability.epic.${ability.card.id}`;
    }
    if (ability.isCardAbilityStep() && ability.modelIdentifier) {
        const namespace = ability.modelAbilityOrigin?.internalName ?? ability.card.internalName;
        return ability.modelIdentifier.startsWith(`${namespace}_`) ? `ability.${ability.modelIdentifier}` : undefined;
    }
    // An implemented event has one printed root ability, even when upstream leaves its identifier anonymous.
    if (ability.isCardAbility() && ability.card.isEvent() && ability === ability.card.getEventAbility()) {
        return `ability.event.${ability.card.id}`;
    }
    if (ability.isCardAbilityStep() && !ability.stepIdentifier.includes('_anonymous')) {
        return `ability.${ability.stepIdentifier}`;
    }
    return undefined;
}

/** Bind an internal typed menu descriptor to this live prompt. */
export function bindModelMenu(descriptor: IModelPrompt | undefined, uuid: string): IModelPrompt | null {
    if (!descriptor) {
        return null;
    }
    return { ...descriptor, options: descriptor.options.map((option) => ({ ...option,
        args: option.command === 'menuButton' && option.args.length === 1 ? [...option.args, uuid] : option.args })) };
}

/** Play permissions from different visible sources are distinct choices, even for the same card. */
export function modelPlayAbilityKey(ability: PlayCardAction, player: Player): string | undefined {
    let key = `action.play.${ability.playType}`;
    if (ability.modelAlternateCostKey !== undefined) {
        if (!(/^[a-zA-Z0-9_-]+$/).test(ability.modelAlternateCostKey)) {
            return undefined;
        }
        key += `.alternate.${ability.card.id}.${ability.modelAlternateCostKey}`;
    }
    if (!ability.playPermission) {
        return key;
    }
    const source = modelSource(ability.playPermission.source, player);
    return source ? `${key}.via.${source.cardKey}` : undefined;
}

/** Reuse choices identify both the selected ability and its visible holder. */
export function modelAbilityMenu(abilities: PlayerOrCardAbility[], player: Player, sourceCard: Card, rootActorId: string): IModelPrompt | undefined {
    const source = modelSource(sourceCard, player);
    const options = abilities.map((ability, index): IModelOption => ({
        kind: 'choose_ability', sourceId: ability.card.uuid, abilityOriginId: modelAbilityOriginId(ability, player), abilityKey: modelAbilityKey(ability, player),
        command: 'menuButton', args: [index], costUnknown: true
    }));
    if (!source || abilities.some((ability) => !modelSource(ability.card, player)) || options.some((option) => !option.abilityKey)) {
        return undefined;
    }
    return { family: 'ability', source, rootActorId, options };
}

/** Physical origin is useful when two copies grant otherwise identical actions. */
export function modelAbilityOriginId(ability: PlayerOrCardAbility, player: Player): string | undefined {
    const origin = ability.isCardAbilityStep() ? ability.modelAbilityOrigin : ability.isPlayCardAbility() ? ability.playPermission?.source : undefined;
    return modelSource(origin, player)?.instanceId ?? undefined;
}
