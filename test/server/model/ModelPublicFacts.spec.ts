describe('Opt-in current public card facts', function() {
    integration(function(contextRef) {
        beforeEach(function() {
            contextRef.context.game.enableModelState();
            return contextRef.setupTestAsync({
                phase: 'action', format: 'eternal',
                player1: { hasForceToken: true, credits: 2, groundArena: ['echo-base-defender'], spaceArena: ['restored-arc170'] },
                player2: { credits: 3, hand: ['vanquish'], resources: ['wampa'] }
            });
        });

        it('includes public Credit and Force facts for each seat without exposing hidden card identities', function() {
            const { context } = contextRef;
            const ownId = context.player1.player.id;
            const otherId = context.player2.player.id;
            const state = context.game.getModelState(ownId);
            expect(state.state.players[ownId].hasForceToken).toBeTrue();
            expect(state.state.players[ownId].credits).toBe(2);
            expect(state.state.players[otherId].hasForceToken).toBeFalse();
            expect(state.state.players[otherId].credits).toBe(3);
            expect(state.cardFacts.some((fact) => fact.id === context.vanquish.uuid)).toBeFalse();
            expect(state.cardFacts.some((fact) => fact.id === context.wampa.uuid)).toBeFalse();
            expect(context.game.getModelState(otherId).cardFacts.some((fact) => fact.id === context.vanquish.uuid)).toBeTrue();
        });

        it('reports current numeric and presence keywords read-only and keeps opt-in fields off ordinary payloads', function() {
            const { context } = contextRef;
            const id = context.player1.player.id;
            const state = context.game.getModelState(id);
            const restore = state.cardFacts.find((fact) => fact.id === context.restoredArc170.uuid);
            const sentinel = state.cardFacts.find((fact) => fact.id === context.echoBaseDefender.uuid);
            expect(restore.keywordFacts).toContain({ key: 'restore', amount: 1 });
            expect(sentinel.keywordFacts).toContain({ key: 'sentinel', amount: 1 });
            expect(restore.keywordCoverageComplete).toBeTrue();
            expect(context.game.getModelState(id)).toEqual(state);
            expect(context.game.getState(id).cardFacts).toBeUndefined();
            expect(context.game.getState(id).players[id].cardFacts).toBeUndefined();
        });
    });
});
