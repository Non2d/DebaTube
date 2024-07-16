const fetchNodes = async (roundId) => {
  try {
    const originX = 100;
    const xposOpp = 300;
    const nodes = []
    const response = await fetch(`http://localhost:8080/round/${roundId}`);
    const data = await response.json();

    for (let speechId = 0; speechId < data.speeches.length; speechId++) {
      const speech = data.speeches[speechId];
      let isOpp = speechId % 2 === 1 ? 1 : 0;
      if (speechId > data.speeches.length - 3) {
        isOpp = 1 - isOpp;
      }

      const nodeType = isOpp ? "oppNode" : "govNode";
      for (let i = 0; i < speech.ADUs.length; i++) {
        let initAduFlag = -1;
        if(i==0){
          initAduFlag = speechId;
        }

        let adu = speech.ADUs[i];
        nodes.push({ id: "adu-" + adu.sequence_id.toString(), type: nodeType, position: { x: originX + xposOpp * isOpp, y: null }, data: { label: "", initAduFlag: initAduFlag } });
      }
    }
    return nodes;
  } catch (error) {
    console.error('Failed to fetch nodes:', error);
  }
};

export default fetchNodes;