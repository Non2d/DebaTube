import { isGovernmentFromSpeechId } from '../utils/speechIdToPositionName';

const fetchNodes = async (roundId) => {
  try {
    const originX = 100;
    const xposOpp = 300;
    const nodes = []
    const response = await fetch(`http://localhost:8080/rounds/${roundId}`);
    const data = await response.json();

    for(const speechId in data.speeches){
      const isGovernment = isGovernmentFromSpeechId(speechId, data.speeches.length);
      const nodeType = isGovernment ? "govNode" : "oppNode";

      for(const argumentUnit of data.speeches[speechId].argument_units){
        nodes.push({ id: "adu-" + argumentUnit.sequence_id.toString(), type: nodeType, position: { x: originX + xposOpp * !isGovernment, y: null }, data: { label: argumentUnit.transcript } });
      }
    }
    return nodes;
  } catch (error) {
    console.error('Failed to fetch nodes:', error);
  }
};

export default fetchNodes;