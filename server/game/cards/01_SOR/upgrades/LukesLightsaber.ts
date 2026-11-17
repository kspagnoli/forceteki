import type { IAbilityHelper } from '../../../AbilityHelper';
import type { IUpgradeAbilityRegistrar } from '../../../core/card/AbilityRegistrationInterfaces';
import { UpgradeCard } from '../../../core/card/UpgradeCard';
import { Trait } from '../../../core/Constants';

export default class LukesLightsaber extends UpgradeCard {
    protected override getImplementationId() {
        return {
            id: '6903722220',
            internalName: 'lukes-lightsaber',
        };
    }

    public override setupCardAbilities(registrar: IUpgradeAbilityRegistrar, AbilityHelper: IAbilityHelper) {
        registrar.setAttachCondition((context) => !context.attachTarget.hasSomeTrait(Trait.Vehicle));

        registrar.addWhenPlayedAbility({
            title: 'Heal all damage from Luke and give him a shield token',
            immediateEffect: AbilityHelper.immediateEffects.conditional((context) => {
                // Retain the original attachment if uniqueness defeated the newly played copy.
                const attachedUnit = context.source.isAttached() ? context.source.parentUnit : context.event.attachTarget;
                return {
                    target: attachedUnit,
                    condition: attachedUnit?.title === 'Luke Skywalker',
                    onTrue: AbilityHelper.immediateEffects.simultaneous([
                        AbilityHelper.immediateEffects.heal({ amount: attachedUnit.damage }),
                        AbilityHelper.immediateEffects.giveShield()]),
                };
            })
        });
    }
}
