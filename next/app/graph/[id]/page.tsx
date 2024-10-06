import DebateFlow from '../../../components/DebateGraph/DebateFlow';

export default function Home(props: any) {
  const roundId = props.params.id; //urlのloaclhost:3000/graph/[id]のidを取得
  return (
    <div>
      <DebateFlow roundId={roundId} />
    </div>
  );
}