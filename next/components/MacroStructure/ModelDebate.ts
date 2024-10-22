interface DataRebuttal {
    id: number;
    src: number;
    tgt: number;
}

type Rebuttal = [number, number];

export const dataRebuttals2Tuples = (dataRebuttals: DataRebuttal[]): Rebuttal[] => {
    return dataRebuttals.map((rebuttal): Rebuttal => {
        return [rebuttal.src, rebuttal.tgt];
    });
}

export const getRallyIds = (rebuttals: Rebuttal[]): number[] => {
    const idsRallying: number[] = [];
    const srcs: number[] = rebuttals.map((rebuttal) => rebuttal[0]);
    const tgts: number[] = rebuttals.map((rebuttal) => rebuttal[1]);

    // すべてのペアをループ
    for (let i = 0; i < rebuttals.length; i++) {
        if (srcs.includes(rebuttals[i][0]) || tgts.includes(rebuttals[i][1])) {
            if (!idsRallying.includes(i)) {
                idsRallying.push(i);
            }
        }
    }

    return idsRallying;
}