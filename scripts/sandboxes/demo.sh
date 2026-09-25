#!/usr/bin/env bash
# Builds a good-looking demo repository (a small game project) for screenshots and videos.
# Usage: scripts/sandboxes/demo.sh   → repo space-racer@local, workspace /tmp/uvcs-demo
set -euo pipefail
REPO=space-racer@local
WK=/tmp/uvcs-demo

cm rmrep "$REPO" >/dev/null 2>&1 || true
cm wk delete "$WK" >/dev/null 2>&1 || true
rm -rf "$WK"
cm mkrep "$REPO" >/dev/null
mkdir -p "$WK" && cm wk create space-racer "$WK" "$REPO" >/dev/null
cd "$WK"

commit() { cm ci --all --private -c "$1" >/dev/null; }
# cm detects edits by timestamp, so edits in the same second as the last checkin would be missed.
w() { sleep 1; mkdir -p "$(dirname "$1")"; cat > "$1"; }
edit() { sleep 1; sed -i '' "$1" "$2"; }

w Assets/Scripts/PlayerController.cs <<'CS'
using UnityEngine;

public class PlayerController : MonoBehaviour
{
    [SerializeField] float speed = 12f;
    [SerializeField] float turnRate = 180f;

    Rigidbody body;

    void Awake() => body = GetComponent<Rigidbody>();

    void FixedUpdate()
    {
        float thrust = Input.GetAxis("Vertical");
        float turn = Input.GetAxis("Horizontal");

        body.AddForce(transform.forward * thrust * speed);
        transform.Rotate(0, turn * turnRate * Time.fixedDeltaTime, 0);
    }
}
CS
w Assets/Scripts/GameManager.cs <<'CS'
using UnityEngine;

public class GameManager : MonoBehaviour
{
    public static GameManager Instance { get; private set; }
    public int Lap { get; private set; } = 1;

    void Awake() => Instance = this;

    public void CompleteLap() => Lap++;
}
CS
w README.md <<'MD'
# Space Racer

A tiny arcade racer used to demo Unity Version Control.
MD
w ProjectSettings/ProjectVersion.txt <<'TXT'
m_EditorVersion: 6000.0.38f1
TXT
cm add -R . >/dev/null
commit "Initial project structure"

sleep 1; printf '\n## Controls\n\nW/S to accelerate, A/D to steer.\n' >> README.md
commit "Document the controls"
cm label create lb:v0.1 -c "First playable" >/dev/null

branch() { cm br create "$1" -c "$2" >/dev/null; cm switch "$1" --noinput >/dev/null; }

branch /main/boost "Nitro boost with cooldown"
w Assets/Scripts/Boost.cs <<'CS'
using UnityEngine;

public class Boost : MonoBehaviour
{
    [SerializeField] float multiplier = 2.5f;
    [SerializeField] float cooldown = 4f;
    float readyAt;

    public float Apply(float speed)
    {
        if (!Input.GetKey(KeyCode.Space) || Time.time < readyAt) return speed;
        readyAt = Time.time + cooldown;
        return speed * multiplier;
    }
}
CS
commit "Add nitro boost"
edit 's/cooldown = 4f/cooldown = 3f/' Assets/Scripts/Boost.cs
commit "Shorter boost cooldown after playtest"

cm switch /main --noinput >/dev/null
branch /main/hud "Lap counter and speedometer"
w Assets/Scripts/HudView.cs <<'CS'
using UnityEngine;
using UnityEngine.UI;

public class HudView : MonoBehaviour
{
    [SerializeField] Text lapLabel;
    [SerializeField] Text speedLabel;

    void Update()
    {
        lapLabel.text = $"Lap {GameManager.Instance.Lap}/3";
    }
}
CS
commit "Lap counter HUD"
edit 's/    \[SerializeField\] Text speedLabel;/    [SerializeField] Text speedLabel;\n    [SerializeField] Rigidbody player;/' Assets/Scripts/HudView.cs
commit "Speedometer wiring"

cm switch /main --noinput >/dev/null
cm merge br:/main/boost --merge >/dev/null
commit "Merge nitro boost"
cm label create lb:v0.2 -c "Boost playtest build" >/dev/null

branch /main/ghost-mode "Race against your best lap"
w Assets/Scripts/GhostRecorder.cs <<'CS'
using System.Collections.Generic;
using UnityEngine;

public class GhostRecorder : MonoBehaviour
{
    readonly List<Vector3> path = new();

    void FixedUpdate() => path.Add(transform.position);

    public IReadOnlyList<Vector3> BestLap => path;
}
CS
commit "Record ghost path"

cm switch /main --noinput >/dev/null
cm merge br:/main/hud --merge >/dev/null
commit "Merge HUD"

# A branch that conflicts with main in PlayerController.cs, for the merge demo.
branch /main/drift "Drift physics"
edit 's/float turnRate = 180f;/float turnRate = 220f;\n    [SerializeField] float driftGrip = 0.82f;/' Assets/Scripts/PlayerController.cs
edit 's/body.AddForce(transform.forward \* thrust \* speed);/body.AddForce(transform.forward * thrust * speed);\n        body.velocity = Vector3.Lerp(body.velocity, transform.forward * body.velocity.magnitude, driftGrip);/' Assets/Scripts/PlayerController.cs
commit "Drift physics with grip control"

cm switch /main --noinput >/dev/null
edit 's/float turnRate = 180f;/float turnRate = 200f;/' Assets/Scripts/PlayerController.cs
commit "Snappier steering"

# Pending changes to show in the Changes view.
edit 's/float speed = 12f;/float speed = 14f;/' Assets/Scripts/PlayerController.cs
edit 's|        transform.Rotate(0, turn \* turnRate \* Time.fixedDeltaTime, 0);|        transform.Rotate(0, turn * turnRate * Time.fixedDeltaTime, 0);\n        GameManager.Instance.ReportSpeed(body.velocity.magnitude);|' Assets/Scripts/PlayerController.cs
edit 's|    public void CompleteLap() => Lap++;|    public float TopSpeed { get; private set; }\n\n    public void CompleteLap() => Lap++;\n\n    public void ReportSpeed(float speed) => TopSpeed = Mathf.Max(TopSpeed, speed);|' Assets/Scripts/GameManager.cs
w Assets/Scripts/Checkpoint.cs <<'CS'
using UnityEngine;

public class Checkpoint : MonoBehaviour
{
    void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag("Player")) GameManager.Instance.CompleteLap();
    }
}
CS
cm add Assets/Scripts/Checkpoint.cs >/dev/null
echo "Remember to tune drift grip" > notes.txt
echo "Demo ready at $WK"
