describe('Luke\'s Lightsaber', function() {
    integration(function(contextRef) {

        describe('when the newly played copy is defeated by uniqueness', function() {
            beforeEach(async function() {
                await contextRef.setupTestAsync({
                    phase: 'action',
                    player1: {
                        hand: ['lukes-lightsaber'],
                        groundArena: [
                            { card: 'battlefield-marine', upgrades: ['lukes-lightsaber'] },
                            { card: 'luke-skywalker#jedi-knight', damage: 3 }
                        ]
                    },
                    player2: { groundArena: ['wampa'] }
                });
                const { context } = contextRef;
                const copies = context.player1.findCardsByName('lukes-lightsaber');
                context.newSaber = copies.find((card) => card.zoneName === 'hand');
                context.oldSaber = copies.find((card) => card.zoneName === 'groundArena');
            });

            it('does not trigger the named-unit benefit for an unrelated attached unit', function() {
                const { context } = contextRef;
                context.player1.clickCard(context.newSaber);
                context.player1.clickCard(context.wampa);
                context.player1.clickCard(context.newSaber);

                expect(context.newSaber).toBeInZone('discard');
                expect(context.oldSaber).toBeInZone('groundArena');
                expect(context.wampa.damage).toBe(0);
                expect(context.wampa).toHaveExactUpgradeNames([]);
                expect(context.player2).toBeActivePlayer();
            });

            it('still resolves its When Played benefit using the original attachment', function() {
                const { context } = contextRef;
                context.player1.clickCard(context.newSaber);
                context.player1.clickCard(context.lukeSkywalker);
                context.player1.clickCard(context.newSaber);

                expect(context.lukeSkywalker.damage).toBe(0);
                expect(context.lukeSkywalker).toHaveExactUpgradeNames(['shield']);

                expect(context.newSaber).toBeInZone('discard');
                expect(context.oldSaber).toBeInZone('groundArena');
                expect(context.player2).toBeActivePlayer();
            });
        });

        describe('Luke\'s Lightsaber\'s ability', function() {
            beforeEach(function () {
                return contextRef.setupTestAsync({
                    phase: 'action',
                    player1: {
                        hand: ['lukes-lightsaber'],
                        groundArena: [{ card: 'luke-skywalker#jedi-knight', damage: 5, upgrades: ['shield'] }, { card: 'battlefield-marine', damage: 2 }, 'reinforcement-walker'],
                        leader: { card: 'luke-skywalker#faithful-friend', deployed: true }
                    }
                });
            });

            it('should heal all damage from and give a shield to its holder when played, only if that unit is Luke Skywalker', function () {
                const { context } = contextRef;

                context.player1.clickCard(context.lukesLightsaber);
                expect(context.player1).toBeAbleToSelectExactly([context.lukeSkywalkerJediKnight, context.lukeSkywalkerFaithfulFriend, context.battlefieldMarine]);

                context.player1.clickCard(context.lukeSkywalkerJediKnight);

                expect(context.lukeSkywalkerJediKnight.damage).toBe(0);
                expect(context.lukeSkywalkerJediKnight).toHaveExactUpgradeNames(['lukes-lightsaber', 'shield', 'shield']);
            });

            it('should give a shield to Luke when played on him even if it doesn\'t heal any damage', function () {
                const { context } = contextRef;

                context.player1.clickCard(context.lukesLightsaber);
                expect(context.player1).toBeAbleToSelectExactly([context.lukeSkywalkerJediKnight, context.lukeSkywalkerFaithfulFriend, context.battlefieldMarine]);

                context.player1.clickCard(context.lukeSkywalkerFaithfulFriend);

                expect(context.lukeSkywalkerFaithfulFriend).toHaveExactUpgradeNames(['lukes-lightsaber', 'shield']);
            });

            it('should have no effect on any unit other than Luke Skywalker', function () {
                const { context } = contextRef;

                context.player1.clickCard(context.lukesLightsaber);
                expect(context.player1).toBeAbleToSelectExactly([context.lukeSkywalkerJediKnight, context.lukeSkywalkerFaithfulFriend, context.battlefieldMarine]);

                context.player1.clickCard(context.battlefieldMarine);

                expect(context.battlefieldMarine.damage).toBe(2);
                expect(context.battlefieldMarine).toHaveExactUpgradeNames(['lukes-lightsaber']);
            });
        });
    });
});
