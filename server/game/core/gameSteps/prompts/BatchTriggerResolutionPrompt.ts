import type { IModelPrompt } from '../../model/ModelPrompt';
import type { Player } from '../../Player';
import type { Game } from '../../Game';
import { OngoingEffectSource } from '../../ongoingEffect/OngoingEffectSource';
import { PromptType, type ITriggerWindowSourceCard } from '../PromptInterfaces';
import type { IPlayerPromptStateProperties } from '../../PlayerPromptState';
import { UiPrompt } from './UiPrompt';

export interface IBatchTriggerResolutionPromptProperties {
    modelSource?: IModelPrompt['source'];
    sourceCard?: ITriggerWindowSourceCard;
    title: string;
    remainingCount: number;
    onResolveNext: () => void;
    onResolveAll: () => void;
}

/**
 * Modal shown after a player selects a grouped trigger in the resolution-order prompt. It displays the
 * trigger's card and lets the player choose to resolve just the next instance or all remaining instances
 * of that trigger at once.
 */
export class BatchTriggerResolutionPrompt extends UiPrompt {
    private readonly source = new OngoingEffectSource(this.game, 'Resolve Grouped Triggers');
    private readonly player: Player;
    private readonly properties: IBatchTriggerResolutionPromptProperties;

    public constructor(
        game: Game,
        player: Player,
        properties: IBatchTriggerResolutionPromptProperties
    ) {
        super(game);

        this.player = player;
        this.properties = properties;
    }

    public override getModelPrompt(_player: Player): IModelPrompt {
        return { family: 'trigger_order', source: this.properties.modelSource, options: [
            { kind: 'choose_option', optionKey: 'trigger.resolve_next', quantity: 1, command: 'menuButton', args: ['next', this.uuid] },
            { kind: 'choose_option', optionKey: 'trigger.resolve_all', quantity: this.properties.remainingCount, command: 'menuButton', args: ['all', this.uuid] }
        ] };
    }

    public override activeCondition(player: Player): boolean {
        return player === this.player;
    }

    public override activePromptInternal(): IPlayerPromptStateProperties {
        const { title, remainingCount, sourceCard } = this.properties;

        return {
            menuTitle: `Resolve "${title}"`,
            buttons: [
                { text: 'Resolve next', arg: 'next' },
                { text: `Resolve all (${remainingCount})`, arg: 'all' }
            ],
            promptTitle: this.source.name,
            promptUuid: this.uuid,
            promptType: PromptType.BatchTriggerResolution,
            batchTriggerResolution: { sourceCard, title, remainingCount }
        };
    }

    public override waitingPrompt(): IPlayerPromptStateProperties {
        return {
            menuTitle: 'Waiting for opponent',
            promptUuid: this.uuid
        };
    }

    public override menuCommand(_player: Player, arg: string): boolean {
        switch (arg) {
            case 'next':
                this.properties.onResolveNext();
                this.complete();
                return true;
            case 'all':
                this.properties.onResolveAll();
                this.complete();
                return true;
            default:
                return false;
        }
    }
}
