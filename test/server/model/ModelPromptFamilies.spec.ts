import { SelectTargetResolver } from '../../../server/game/core/ability/abilityTargets/SelectTargetResolver';
import { TargetMode } from '../../../server/game/core/Constants';

describe('Typed model prompt families', function() {
    integration(function(contextRef) {
        beforeEach(function() {
            contextRef.context.game.enableModelState();
            return contextRef.setupTestAsync({ phase: 'action', format: 'eternal',
                player1: { leader: 'luke-skywalker#faithful-friend', resources: 8,
                    hand: ['leia-organa#defiant-princess', 'r2d2#ignoring-protocol', 'c3po#protocol-droid'],
                    deck: ['wampa', 'battlefield-marine', 'alliance-xwing'] },
                player2: { resources: 3, groundArena: ['death-star-stormtrooper'] } });
        });

        it('retains no-effect leader actions and binds confirmation separately from cancellation', function() {
            const { context } = contextRef;
            context.player1.clickCard(context.player1.leader);
            const actions = context.game.getModelState(context.player1.player.id).prompt;
            expect(actions.family).toBe('ability');
            const choices = actions.options.filter((option) => option.kind === 'choose_ability');
            expect(choices.length).toBe(2);
            expect(choices.every((choice) => choice.sourceId === context.player1.leader.uuid && !!choice.abilityKey)).toBeTrue();
            expect(choices.some((choice) => choice.hasLegalEffects === false)).toBeTrue();
            const noEffect = choices.find((choice) => choice.hasLegalEffects === false);
            const button = context.player1.player.currentPrompt().buttons.find((choice) => choice.arg === noEffect.args[0]);
            context.player1.clickPrompt(button.text);
            const confirmation = context.game.getModelState(context.player1.player.id).prompt;
            expect(confirmation.family).toBe('no_effect_confirmation');
            expect(confirmation.source.cardKey).toBe(context.player1.leader.id);
            expect(confirmation.options.map((option) => option.kind)).toEqual(['accept', 'cancel']);
            expect(confirmation.options[0].costUnknown).toBeTrue();
            context.player1.clickPrompt('Cancel');
        });

        it('retains every offered static mode with its printed option identity', function() {
            const { context } = contextRef;
            context.player1.clickCard(context.leiaOrgana);
            const prompt = context.game.getModelState(context.player1.player.id).prompt;
            expect(prompt.family).toBe('modal');
            expect(prompt.options.map((option) => option.optionKey)).toEqual([
                'ability.leia-organa#defiant-princess_triggered_0.choice.target.0',
                'ability.leia-organa#defiant-princess_triggered_0.choice.target.1',
                'ability.leia-organa#defiant-princess_triggered_0.choice.target.2'
            ]);
            expect(prompt.options.map((option) => option.args[0])).toEqual([0, 1, 2]);
            context.player1.clickPrompt('Ready a friendly resource');
        });

        it('keeps the explicit leave-on-top choice enabled even though it has no game effect', function() {
            const { context } = contextRef;
            context.player1.clickCard(context.c3po);
            context.player1.chooseListOption('4');
            const prompt = context.game.getModelState(context.player1.player.id).prompt;
            expect(prompt.family).toBe('display');
            expect(prompt.options.length).toBe(2);
            expect(prompt.options.some((option) => option.optionKey.endsWith('.view.leave'))).toBeTrue();
            const ordinary = context.player1.player.currentPrompt();
            expect(ordinary.perCardButtons.find((button) => button.arg === 'leave').disabled).toBeFalse();
            context.player1.clickDisplayCardPromptButton(context.wampa.uuid, 'leave');
            expect(context.player1.deck[0]).toBe(context.wampa);
            expect(context.game.getModelState(context.player2.player.id).prompt.family).toBe('action_window');
        });

        it('scopes private display identities to the viewer and removes them when the prompt finishes', function() {
            const { context } = contextRef;
            context.player1.clickCard(context.r2d2);
            const own = context.game.getModelState(context.player1.player.id);
            const other = context.game.getModelState(context.player2.player.id);
            expect(own.prompt.displayCards.map((card) => card.id)).toEqual([context.wampa.id]);
            expect(own.prompt.displayCards[0].zone).toBe('display');
            expect(own.prompt.options.map((option) => option.optionKey)).toEqual(['deck.put_top', 'deck.put_bottom']);
            expect(other.prompt).toBeNull();
            expect(JSON.stringify(other.state.players[context.player1.player.id].cardPiles.deck)).not.toContain(context.wampa.id);
            const ordinary = context.game.getState(context.player1.player.id);
            expect(ordinary.players[context.player1.player.id].promptState.perCardButtons.every((button) => button.modelOptionKey === undefined)).toBeTrue();
            context.player1.clickDisplayCardPromptButton(context.wampa.uuid, 'bottom');
            expect(context.game.getModelState(context.player1.player.id).prompt).toBeNull();
            context.player2.passAction();
            expect(context.game.getModelState(context.player1.player.id).prompt.displayCards).toBeUndefined();
        });
    });

    integration(function(contextRef) {
        beforeEach(function() {
            contextRef.context.game.enableModelState();
            return contextRef.setupTestAsync({ phase: 'action', format: 'eternal',
                player1: { hand: ['grand-moff-tarkin#death-star-overseer'],
                    deck: ['cell-block-guard', 'scout-bike-pursuer', 'academy-defense-walker', 'battlefield-marine', 'wampa'] } });
        });

        it('tracks multi-card display selection, capacity, deselection and reveal acknowledgment', function() {
            const { context } = contextRef;
            const read = () => context.game.getModelState(context.player1.player.id).prompt;
            context.player1.clickCard(context.grandMoffTarkin);
            expect(read().selection.max).toBe(2);
            context.player1.clickCardInDisplayCardPrompt(context.cellBlockGuard);
            context.player1.clickCardInDisplayCardPrompt(context.scoutBikePursuer);
            expect(read().selection.selectedIds).toEqual([context.cellBlockGuard.uuid, context.scoutBikePursuer.uuid]);
            expect(read().options.filter((option) => option.kind === 'select').length).toBe(0);
            context.player1.clickCardInDisplayCardPrompt(context.cellBlockGuard);
            expect(read().selection.selectedIds).toEqual([context.scoutBikePursuer.uuid]);
            expect(read().options.some((option) => option.kind === 'select' && option.targetId === context.cellBlockGuard.uuid)).toBeTrue();
            context.player1.clickDone();
            const reveal = context.game.getModelState(context.player2.player.id).prompt;
            expect(reveal.family).toBe('acknowledgment');
            expect(reveal.displayCards.map((card) => card.id)).toEqual([context.scoutBikePursuer.id]);
            context.player2.clickDone();
        });
    });

    integration(function(contextRef) {
        beforeEach(function() {
            contextRef.context.game.enableModelState();
            return contextRef.setupTestAsync({ phase: 'action', format: 'eternal',
                player1: { groundArena: ['yoda#old-master'] },
                player2: { groundArena: ['rogue-squadron-skirmisher'] } });
        });

        it('deselects only the chosen player and preserves the other selected player', function() {
            const { context } = contextRef;
            context.player1.clickCard(context.yoda);
            context.player1.clickCard(context.rogueSquadronSkirmisher);
            context.player1.clickPrompt('You');
            context.player1.clickPrompt('Opponent');
            context.player1.clickPrompt('You');
            const prompt = context.game.getModelState(context.player1.player.id).prompt;
            expect(prompt.selection.domain).toBe('options');
            expect(prompt.selection.selectedOptionKeys).toEqual(['player.opponent']);
            const selfChoice = prompt.options.find((option) => option.optionKey === 'player.self');
            const otherChoice = prompt.options.find((option) => option.optionKey === 'player.opponent');
            expect(selfChoice.kind).toBe('select');
            expect(otherChoice.kind).toBe('deselect');
            context.player1.clickDone();
        });
    });
});

// A controlled selector case verifies identities before and after legality filtering.
it('typed static mode keys use original positions rather than compacted menu indices', function() {
    let descriptor;
    const source = { getSummary: () => ({ id: 'public-card', uuid: 'visible-source' }) };
    const player = { id: 'self' };
    const ability = { card: source, isAttackAction: () => false, isPlayCardAbility: () => false,
        isCardAbility: () => false, isCardAbilityStep: () => true, stepIdentifier: 'fixture_triggered_0' };
    const context: any = { source, player, ability, selects: {},
        game: { modelStateEnabled: true, promptWithHandlerMenu: (_player, properties) => descriptor = properties.modelPrompt } };
    context.copy = () => ({ ...context, selects: {} });
    const resolver = new SelectTargetResolver('mode', { mode: TargetMode.Select, choices: {
        first: { hasLegalTarget: () => true }, middle: { hasLegalTarget: () => false }, last: { hasLegalTarget: () => true }
    } } as any, null);
    (resolver as any).resolveInternal(player, context, {});
    expect(descriptor.options.map((option) => option.optionKey)).toEqual([
        'ability.fixture_triggered_0.choice.mode.0', 'ability.fixture_triggered_0.choice.mode.2'
    ]);
    expect(descriptor.options.map((option) => option.args[0])).toEqual([0, 1]);
});
