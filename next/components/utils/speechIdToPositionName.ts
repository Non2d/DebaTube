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

export function isGovernment(positionName:string):boolean{
    const governmentPositionNames = ["PM", "DPM", "MG", "GW", "PMR"];
    return governmentPositionNames.includes(positionName)
}