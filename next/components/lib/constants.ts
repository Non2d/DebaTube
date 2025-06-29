export const diarizationColors = [
    'rgba(255, 87, 51, 0.5)', // Red
    'rgba(51, 255, 87, 0.5)', // Green
    'rgba(51, 87, 255, 0.5)', // Blue
    'rgba(255, 51, 161, 0.5)', // Pink
    'rgba(51, 255, 245, 0.5)', // Cyan
    'rgba(255, 165, 0, 0.5)', // Light Orange
    'rgba(140, 51, 255, 0.5)', // Purple
    'rgba(255, 51, 51, 0.5)', // Dark Red
    'rgba(51, 51, 255, 0.5)', // Dark Blue
    'rgba(255, 215, 0, 0.5)', // Gold
    'rgba(255, 105, 180, 0.5)', // Hot Pink
    'rgba(139, 0, 0, 0.5)', // Dark Red
    'rgba(0, 255, 0, 0.5)', // Lime
    'rgba(0, 206, 209, 0.5)', // Dark Turquoise
    'rgba(148, 0, 211, 0.5)', // Dark Violet
    'rgba(255, 69, 0, 0.5)', // Orange Red
    'rgba(46, 139, 87, 0.5)', // Sea Green
    'rgba(70, 130, 180, 0.5)', // Steel Blue
    'rgba(210, 105, 30, 0.5)', // Chocolate
    'rgba(255, 20, 147, 0.5)', // Deep Pink
    'rgba(30, 144, 255, 0.5)', // Dodger Blue
    'rgba(50, 205, 50, 0.5)', // Lime Green
    'rgba(255, 99, 71, 0.5)',  // Tomato
    'rgba(64, 224, 208, 0.5)', // Turquoise
    'rgba(51, 255, 140, 0.5)', // Light Green
];

export const speechIdToPositionNameAsian = [
    "PM",
    "LO",
    "DPM",
    "DLO",
    "GW",
    "OW",
    "LOR",
    "PMR",
];

export const speechIdToPositionNameNA = [
    "PM",
    "LO",
    "MG",
    "MO",
    "LOR",
    "PMR",
];

export const nodeIdToNumber = (nodeId: string) => {
    return Number(nodeId?.split('-')[1]);
}

export const isGovernment = (positionName: string): boolean => {
    const governmentPositionNames = ["PM", "DPM", "MG", "GW", "PMR"];
    return governmentPositionNames.includes(positionName);
}

export const isGovernmentFromSpeechId = (speechId: number, speechLength: number): boolean => {
    if (speechLength === 6) {
        return speechId === 0 || speechId === 2 || speechId === 5;
    } else if (speechLength === 8) {
        return speechId === 0 || speechId === 2 || speechId === 4 || speechId === 7;
    } else {
        throw new Error("Invalid speech length");
    }
}
