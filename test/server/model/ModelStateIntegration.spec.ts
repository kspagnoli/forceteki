describe('Opt-in model state source', function() {
    integration(function(contextRef) {
        beforeEach(function() {
            contextRef.context.game.enableModelState();
            return contextRef.setupTestAsync({
                phase: 'action', format: 'eternal',
                player1: { leader: 'luke-skywalker#faithful-friend', hand: ['leia-organa#defiant-princess'], resources: 5 },
                player2: { leader: 'darth-vader#dark-lord-of-the-sith', groundArena: ['death-star-stormtrooper'] }
            });
        });

        it('does not consume normal chat delivery or append model fields to ordinary player state', function() {
            const { context } = contextRef;
            const id = context.player1.player.id;
            context.game.getState(id);
            context.game.addMessage('Model observation cursor marker');
            const model = context.game.getModelState(id);
            const ordinary = context.game.getState(id);
            expect(JSON.stringify(ordinary.newMessages)).toContain('Model observation cursor marker');
            expect(ordinary.players[id].promptState.modelPrompt).toBeUndefined();
            expect(model.prompt.family).toBe('action_window');
            expect(model.state.players[context.player2.player.id].promptState).toBeUndefined();
        });

        it('records an actual play and the authoritative target set for Luke shield', function() {
            const { context } = contextRef;
            context.player1.clickCard(context.leiaOrgana);
            context.player1.clickPrompt('Ready a friendly resource');
            context.player2.passAction();
            const source = context.game.getModelState(context.player1.player.id);
            expect(source.context.history.phasePlays.length).toBe(1);
            expect(source.context.history.phasePlays[0].cardKey).toBe(context.leiaOrgana.id);
            expect(source.context.previousActionWasPass).toBeTrue();
            expect(source.context.finishedActing[context.player2.player.id]).toBeFalse();
            context.player1.clickCard(context.player1.leader);
            const target = context.game.getModelState(context.player1.player.id).prompt;
            expect(target.family).toBe('target');
            expect(target.selection.min).toBe(1);
            expect(target.selection.max).toBe(1);
            expect(target.options.filter((option) => option.kind === 'select_target').map((option) => option.targetId)).toEqual([context.leiaOrgana.uuid]);
            context.player1.clickCard(context.leiaOrgana);
            expect(context.leiaOrgana.hasShield()).toBeTrue();
        });
    });
});
