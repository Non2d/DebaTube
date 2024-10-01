import DebateFlow from '../../../components/DebateGraph/DebateFlow';

export default function Home(props) {
  const roundId = props.params.id;
  return (
    <div>
      <DebateFlow roundId={roundId} />
    </div>
  );
}
