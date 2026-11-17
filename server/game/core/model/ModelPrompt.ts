import type { Player } from '../Player';
import type { PlayerOrCardAbility } from '../ability/PlayerOrCardAbility';
import type { Card } from '../card/Card';

/** Player-scoped, opt-in metadata. Never included in ordinary game-state payloads. */
export interface IModelOption {
    kind: string;
    command: string;
    args: unknown[];
    sourceId?: string;
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
        kind: 'indirect_damage';
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
        return `action.play.${ability.playType}`;
    }
    if (ability.isCardAbility() && !ability.printedAbility) {
        return undefined;
    }
    // An implemented event has one printed root ability, even when upstream leaves its identifier anonymous.
    if (ability.isCardAbility() && ability.card.isEvent() && ability === ability.card.getEventAbility()) {
        return `ability.event.${ability.card.id}`;
    }
    if (ability.isCardAbilityStep() && !ability.stepIdentifier.endsWith('_anonymous')) {
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
