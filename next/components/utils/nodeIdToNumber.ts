const NodeIdToNumber = (nodeId: string) => {
    return Number(nodeId?.split('-')[1]);
}

export default NodeIdToNumber;