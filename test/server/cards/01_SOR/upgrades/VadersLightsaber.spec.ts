describe('Vader\'s Lightsaber', function() {
    integration(function(contextRef) {

        describe('when the newly played copy is defeated by uniqueness', function() {
            beforeEach(async function() {
                await contextRef.setupTestAsync({
                    phase: 'action',
                    player1: {
                        hand: ['vaders-lightsaber'],
                        groundArena: [
                            { card: 'battlefield-marine', upgrades: ['vaders-lightsaber'] },
                            { card: 'darth-vader#commanding-the-first-legion', damage: 3 }
                        ]
                    },
                    player2: { groundArena: ['wampa'] }
                });
                const { context } = contextRef;
                const copies = context.player1.findCardsByName('vaders-lightsaber');
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
                context.player1.clickCard(context.darthVader);
                context.player1.clickCard(context.newSaber);

                expect(context.player1).toBeAbleToSelectExactly([context.wampa, context.darthVader, context.battlefieldMarine]);
                context.player1.clickCard(context.wampa);
                expect(context.wampa.damage).toBe(4);

                expect(context.newSaber).toBeInZone('discard');
                expect(context.oldSaber).toBeInZone('groundArena');
                expect(context.player2).toBeActivePlayer();
            });
        });

        describe('Vader\'s Lightsaber\'s ability', function() {
            beforeEach(function () {
                return contextRef.setupTestAsync({
                    phase: 'action',
                    player1: {
                        hand: ['vaders-lightsaber'],
                        groundArena: ['darth-vader#commanding-the-first-legion'],
                        spaceArena: ['tieln-fighter'],
                    },
                    player2: {
                        groundArena: ['wampa'],
                        spaceArena: ['cartel-spacer'],
                    }
                });
            });

            it('should deal 4 damage to a ground unit when attached to the Darth Vader unit', function () {
                const { context } = contextRef;

                context.player1.clickCard(context.vadersLightsaber);
                expect(context.player1).toBeAbleToSelectExactly([context.darthVader, context.wampa]);    // cannot attach to vehicles
                context.player1.clickCard(context.darthVader);

                expect(context.darthVader).toHaveExactUpgradeNames(['vaders-lightsaber']);
                expect(context.player1).toBeAbleToSelectExactly([context.wampa, context.darthVader]);
                expect(context.player1).toHavePassAbilityButton();

                context.player1.clickCard(context.wampa);
                expect(context.wampa.damage).toBe(4);

                expect(context.player2).toBeActivePlayer();
            });

            it('should do nothing when attached to a unit that is not Darth Vader', function () {
                const { context } = contextRef;

                context.player1.clickCard(context.vadersLightsaber);
                context.player1.clickCard(context.wampa);

                expect(context.wampa).toHaveExactUpgradeNames(['vaders-lightsaber']);
                expect(context.player2).toBeActivePlayer();
            });
        });

        describe('Vader\'s Lightsaber\'s ability', function() {
            beforeEach(function () {
                return contextRef.setupTestAsync({
                    phase: 'action',
                    player1: {
                        hand: ['vaders-lightsaber'],
                        spaceArena: ['tieln-fighter'],
                        leader: { card: 'darth-vader#dark-lord-of-the-sith', deployed: true },
                    },
                    player2: {
                        groundArena: ['wampa'],
                        spaceArena: ['cartel-spacer'],
                    }
                });
            });

            it('should deal 4 damage to a ground unit when attached to the Darth Vader leader', function () {
                const { context } = contextRef;

                context.player1.clickCard(context.vadersLightsaber);
                context.player1.clickCard(context.darthVader);

                expect(context.darthVader).toHaveExactUpgradeNames(['vaders-lightsaber']);
                expect(context.player1).toBeAbleToSelectExactly([context.wampa, context.darthVader]);
                expect(context.player1).toHavePassAbilityButton();

                context.player1.clickCard(context.wampa);
                expect(context.wampa.damage).toBe(4);

                expect(context.player2).toBeActivePlayer();
            });
        });
    });
});
