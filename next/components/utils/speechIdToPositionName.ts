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

export function isGovernmentFromSpeechId(speechId:number, speechLength:number):boolean{
    if(speechLength==6){
        return speechId==0 || speechId==2 || speechId==5
    } else if(speechLength==8){
        return speechId==0 || speechId==2 || speechId==4 || speechId==7
    } else {
        throw new Error("Invalid speech length")
    }
}