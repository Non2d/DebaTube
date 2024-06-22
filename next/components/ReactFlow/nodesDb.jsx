const fetchNodes = async () => {
  try {
    const xpos = 800;
    const nodes = []
    const response = await fetch('http://localhost:8080/round/45');
    const data = await response.json();

    nodes.push({ id: "proSignpost", type: "rootNode", position: { x: 0, y: 0 }, data: { label: "Proposition Side" } });
    nodes.push({ id: "oppSignpost", type: "rootNode", position: { x: xpos, y: 0 }, data: { label: "Opposition Side" } });
    
    for (let speechId = 0; speechId < data.speeches.length; speechId++) {
      const speech = data.speeches[speechId];
      let isOpp = speechId % 2 === 1 ? 1 : 0;
      if (speechId > data.speeches.length-2){
        isOpp = 1-isOpp;
      }

      const nodeType = isOpp ? "oppNode" : "govNode";
      for (let adu of speech.ADUs) {
        nodes.push({ id: "adu-"+adu.sequence_id.toString(), type: nodeType, position: { x: xpos*isOpp, y: 0 }, data: { label: adu.transcript } });
      }
    }
    return nodes;
  } catch (error) {
    console.error('Failed to fetch nodes:', error);
  }
};

export default fetchNodes;
