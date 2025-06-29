import { diarizationColors } from '../../../components/lib/constants';

interface NodeTimeLabelProps {
    data: {
        speakerId: number;
        width: number;
        height: number;
    };
}

const NodeDiarization: React.FC<NodeTimeLabelProps> = ({ data }) => {
    if(data.speakerId>20){
        console.error("Too many speakers! Color is lacking.")
    }
    return (
        <div
          className="border border-black flex items-center justify-center"
          style={{ width: `${data.width}px`, height: `${data.height}px`, borderWidth: `0px`, backgroundColor: diarizationColors[data.speakerId%20]}}
        >
            {/* {data.speakerId} */}
        </div>
      );
};

export default NodeDiarization;