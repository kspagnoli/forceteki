import type { Player } from '../Player';
import type { PlayerOrCardAbility } from '../ability/PlayerOrCardAbility';
import { PlayUpgradeAction } from '../../actions/PlayUpgradeAction';
import { CardTargetResolver } from '../ability/abilityTargets/CardTargetResolver';
import { Stage, ZoneName } from '../Constants';
import { modelAbilityKey, modelAbilityOriginId } from './ModelPrompt';
import type { IModelOption } from './ModelPrompt';

/** Read the same pre-target attachment selector used by play. Never resolve or choose a target. */
export function modelAttachmentPreview(actions: PlayerOrCardAbility[], player: Player): IModelOption['attachmentPreview'] {
    const attachments = actions.filter((action): action is PlayUpgradeAction => action instanceof PlayUpgradeAction);
    if (attachments.length === 0) {
        return undefined;
    }
    return {
        otherActionCount: actions.length - attachments.length,
        options: attachments.map((action) => {
            const context = action.createContext(player);
            context.stage = Stage.PreTarget;
            const resolver = action.targetResolvers.length === 1 ? action.targetResolvers[0] : null;
            const targets = resolver instanceof CardTargetResolver ? resolver.getAllLegalTargets(context) : null;
            // An incomplete/hidden domain is unknown, never a false known-empty set.
            const publicTargets = targets?.every((card) =>
                [ZoneName.GroundArena, ZoneName.SpaceArena, ZoneName.Base].includes(card.zoneName) && card.getSummary(player)?.id);
            return { abilityKey: modelAbilityKey(action, player), abilityOriginId: modelAbilityOriginId(action, player),
                targetIds: publicTargets ? targets.map((card) => card.uuid) : null };
        })
    };
}
