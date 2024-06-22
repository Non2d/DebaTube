const fetchEdges = async () => {
    try {
        const edges = []
        const response = await fetch('http://localhost:8080/round/47');
        const data = await response.json();

        for (let edge_id in data.rebuttals) {
            console.log(edge_id, data.rebuttals[edge_id]);
            edges.push({id: "reb-"+edge_id.toString(), type: "customEdge", source: "adu-"+data.rebuttals[edge_id].src.toString(), target: "adu-"+data.rebuttals[edge_id].tgt.toString(), animated: true})
        }

        return edges;
    } catch (error) {
        console.error('Failed to fetch nodes:', error);
    }
};

export default fetchEdges;