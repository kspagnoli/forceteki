describe('Opt-in indirect damage descriptors', function() {
    integration(function(contextRef) {
        beforeEach(function() {
            contextRef.context.game.enableModelState();
            return contextRef.setupTestAsync({
                phase: 'action', format: 'eternal', autoSingleTarget: false,
                player1: { spaceArena: [{ card: 'tie-bomber', upgrades: ['targeting-computer'] }] },
                player2: { groundArena: [{ card: 'wampa', damage: 3, upgrades: ['shield'] }] }
            });
        });

        it('exposes the assigning seat, source actor and remaining HP caps without changing the ordinary prompt', function() {
            const { context } = contextRef;
            context.player1.clickCard(context.tieBomber);
            context.player1.clickCard(context.p2Base);
            const actor = context.player1.player.id;
            const prompt = context.game.getModelState(actor).prompt;
            expect(prompt.family).toBe('distribution');
            expect(prompt.rootActorId).toBe(actor);
            expect(prompt.source.cardKey).toBe(context.tieBomber.id);
            expect(prompt.distribution.amount).toBe(3);
            expect(prompt.distribution.kind).toBe('indirect_damage');
            expect(prompt.distribution.targets).toEqual(jasmine.arrayWithExactContents([
                { id: context.wampa.uuid, maximum: 2 }, { id: context.p2Base.uuid, maximum: 3 }
            ]));
            expect(context.game.getModelState(context.player2.player.id).prompt).toBeNull();
            const ordinary = context.player1.player.currentPrompt();
            expect(ordinary.distribution).toBeUndefined();
            expect(ordinary.modelRootActorId).toBeUndefined();
            expect(ordinary.distributeAmongTargets.amount).toBe(3);
            context.player1.setDistributeIndirectDamagePromptState(new Map([
                [context.wampa, 1], [context.p2Base, 2]
            ]));
        });

        it('repeated descriptor reads preserve the pending assignment and indirect shield behavior', function() {
            const { context } = contextRef;
            context.player1.clickCard(context.tieBomber);
            context.player1.clickCard(context.p2Base);
            const actor = context.player1.player.id;
            const before = context.game.getModelState(actor);
            expect(context.game.getModelState(actor)).toEqual(before);
            context.player1.setDistributeIndirectDamagePromptState(new Map([
                [context.wampa, 1], [context.p2Base, 2]
            ]));
            expect(context.wampa.damage).toBe(4);
            expect(context.wampa.hasShield()).toBeTrue();
            expect(context.p2Base.damage).toBe(3);
        });
    });
});
