import { raftAssets, raftEyes } from "@sponsor-engine/brand";

const poses = {
  wave: { file: raftAssets.wave, width: 404, height: 504, alt: "Raft the otter waves." },
  raft: { file: raftAssets.raft, width: 500, height: 400, alt: "Two otters hold each other in the water." },
  approve: { file: raftAssets.approve, width: 404, height: 510, alt: "Raft holds a clipboard." },
} as const;

export function RaftPose({
  pose = "wave",
  size = 180,
  bob = false,
}: {
  pose?: keyof typeof poses;
  size?: number;
  bob?: boolean;
}) {
  const item = poses[pose];
  return (
    <div className={bob ? "raft-bob" : "raft-still"} style={{ width: size }}>
      <img src={`/brand/${item.file}`} alt={item.alt} width={item.width} height={item.height} />
      {bob ? (
        <>
          <span className="raft-lid" style={{ left: `${raftEyes.left.x * 100}%`, top: `${raftEyes.left.y * 100}%` }} />
          <span className="raft-lid" style={{ left: `${raftEyes.right.x * 100}%`, top: `${raftEyes.right.y * 100}%` }} />
        </>
      ) : null}
    </div>
  );
}
