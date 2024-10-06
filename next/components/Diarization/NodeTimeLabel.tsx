import React, { useRef } from 'react';
import { useAppContext } from '../../context/context';
import toast from 'react-hot-toast';

interface NodeTimeLabelProps {
  data: {
    seconds: number;
    ytPlayer: YT.Player;
  };
}

const NodeTimeLabel: React.FC<NodeTimeLabelProps> = ({ data }) => {
  const { youtubeLink } = useAppContext();

  const hours = Math.floor(data.seconds / 3600);
  const minutes = Math.floor((data.seconds % 3600) / 60);
  const seconds = data.seconds % 60;
  const formattedTime = `${hours}:${String(minutes).padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`;

  const popupRef = useRef<Window | null>(null);


  const jumpVideo = () => {
    if(youtubeLink){
      data.ytPlayer.seekTo(data.seconds, true);
    } else {
      toast.error('Youtube link or files are not set.');
    }
    // const youtubeUrl = `${youtubeLink}`+`&t=${Math.floor(data.seconds)}s`;
    // if (popupRef.current && !popupRef.current.closed) {
    //   popupRef.current.location.href = youtubeUrl;
    //   popupRef.current.focus();
    // } else {
    //   popupRef.current = window.open(youtubeUrl, 'youtubePopup', 'width=800,height=600,scrollbars=no,resizable=no,left=1200,top=200');
    // }
  };

  return (
    <div
      style={{
        backgroundColor: 'white',
        cursor: 'pointer',
        textDecoration: 'none',
        color: '#1a73e8',
        fontWeight: 'bold',
        padding: '0px 1px',
        borderRadius: '5px',
        transition: 'background-color 0.3s, color 0.3s',
      }}
      onClick={jumpVideo}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = '#f1f3f4';
        (e.currentTarget as HTMLDivElement).style.color = '#0b66c3';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.backgroundColor = 'white';
        (e.currentTarget as HTMLDivElement).style.color = '#1a73e8';
      }}
    >
      {formattedTime}
    </div>
  );
};

export default NodeTimeLabel;