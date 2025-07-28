function generateRoomId() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function assignRoles(playerCount) {
    let adventurerCount, guardianCount, extraCard;
    
    switch(playerCount) {
        case 3:
            if (Math.random() < 0.5) {
                adventurerCount = 1;
                guardianCount = 2;
            } else {
                adventurerCount = 2;
                guardianCount = 1;
            }
            extraCard = true;
            break;
        case 4:
            if (Math.random() < 0.5) {
                adventurerCount = 2;
                guardianCount = 2;
            } else {
                adventurerCount = 3;
                guardianCount = 1;
            }
            extraCard = true;
            break;
        case 5:
            adventurerCount = 3;
            guardianCount = 2;
            extraCard = false;
            break;
        case 6:
            adventurerCount = 4;
            guardianCount = 2;
            extraCard = false;
            break;
        case 7:
            if (Math.random() < 0.5) {
                adventurerCount = 4;
                guardianCount = 3;
            } else {
                adventurerCount = 5;
                guardianCount = 2;
            }
            extraCard = true;
            break;
        case 8:
            if (Math.random() < 0.5) {
                adventurerCount = 5;
                guardianCount = 3;
            } else {
                adventurerCount = 6;
                guardianCount = 2;
            }
            extraCard = true;
            break;
        case 9:
            adventurerCount = 6;
            guardianCount = 3;
            extraCard = false;
            break;
        case 10:
            if (Math.random() < 0.5) {
                adventurerCount = 6;
                guardianCount = 4;
            } else {
                adventurerCount = 7;
                guardianCount = 3;
            }
            extraCard = true;
            break;
        default:
            adventurerCount = Math.ceil(playerCount * 0.6);
            guardianCount = Math.floor(playerCount * 0.4);
            extraCard = false;
    }

    const totalCards = extraCard ? playerCount + 1 : playerCount;
    const roles = [];
    
    for (let i = 0; i < adventurerCount; i++) {
        roles.push('adventurer');
    }
    for (let i = 0; i < guardianCount; i++) {
        roles.push('guardian');
    }
    
    if (!extraCard && roles.length < totalCards) {
        roles.push(Math.random() < 0.6 ? 'adventurer' : 'guardian');
    }
    
    for (let i = roles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    
    return roles.slice(0, playerCount);
}

function generateAllCards(playerCount) {
    let treasureCount, trapCount, emptyCount;

    switch(playerCount) {
        case 3:
            treasureCount = 5;
            trapCount = 2;
            emptyCount = 8;
            break;
        case 4:
            treasureCount = 6;
            trapCount = 2;
            emptyCount = 12;
            break;
        case 5:
            treasureCount = 7;
            trapCount = 2;
            emptyCount = 16;
            break;
        case 6:
            treasureCount = 8;
            trapCount = 2;
            emptyCount = 20;
            break;
        case 7:
            treasureCount = 7;
            trapCount = 2;
            emptyCount = 26;
            break;
        case 8:
            treasureCount = 8;
            trapCount = 2;
            emptyCount = 30;
            break;
        case 9:
            treasureCount = 9;
            trapCount = 2;
            emptyCount = 34;
            break;
        case 10:
            treasureCount = 10;
            trapCount = 3;
            emptyCount = 37;
            break;
        default:
            treasureCount = 7;
            trapCount = 2;
            emptyCount = 16;
    }

    const cards = [];
    for (let i = 0; i < treasureCount; i++) {
        cards.push({ type: 'treasure', id: `treasure-${i}` });
    }
    for (let i = 0; i < trapCount; i++) {
        cards.push({ type: 'trap', id: `trap-${i}` });
    }
    for (let i = 0; i < emptyCount; i++) {
        cards.push({ type: 'empty', id: `empty-${i}` });
    }
    
    return { cards, treasureCount, trapCount };
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function distributeCards(allCards, playerCount, cardsPerPlayer) {
    const shuffledCards = shuffleArray([...allCards]);
    const playerHands = {};
    
    for (let i = 0; i < playerCount; i++) {
        const hand = shuffledCards.splice(0, cardsPerPlayer);
        playerHands[i] = shuffleArray(hand);
    }
    
    return { playerHands, remainingCards: shuffledCards };
}

function calculateVictoryGoal(playerCount) {
    const treasureGoal = playerCount <= 5 ? 7 : 8;
    const trapGoal = playerCount === 10 ? 3 : 2;
    return { treasureGoal, trapGoal };
}

module.exports = {
    generateRoomId,
    assignRoles,
    generateAllCards,
    shuffleArray,
    distributeCards,
    calculateVictoryGoal
};