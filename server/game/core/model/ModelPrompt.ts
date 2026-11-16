import type { Player } from '../Player';
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
}

export interface IModelPrompt {
    family: string;
    options: IModelOption[];
    selection?: {
        min: number;
        max: number | null;
        ordered: boolean;
        selectedIds: string[];
        canConfirm: boolean;
        canCancel: boolean;
        canDecline: boolean;
    };
    numberRange?: { min: number; max: number };
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
