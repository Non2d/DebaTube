import DebateFlow from '../../../components/ReactFlow/DebateFlow';

export default function Home(props) {
  const roundId = props.params.id;
  return (
    <div>
      <DebateFlow roundId={roundId} />
    </div>
  );
}
