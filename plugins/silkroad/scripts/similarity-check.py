import sys, os, re, glob
def norm(t): return re.sub(r'\s+', '', t)
def grams(t, n): return {t[i:i+n] for i in range(0, max(len(t)-n+1, 0))}
N = int(sys.argv[3]) if len(sys.argv) > 3 else 20
ours = sorted(glob.glob(os.path.join(sys.argv[1], '*/SKILL.md')))
theirs = sorted(glob.glob(os.path.join(sys.argv[2], '**/*.md'), recursive=True))
ref = {}
for p in theirs:
    ref[p] = grams(norm(open(p, encoding='utf-8', errors='ignore').read()), N)
allref = set().union(*ref.values())
for p in ours:
    body = norm(open(p, encoding='utf-8').read())
    g = grams(body, N)
    shared = g & allref
    ratio = len(shared) / max(len(g), 1)
    # longest shared run, approximated by merging consecutive shared grams
    longest = run = 0
    for i in range(len(body) - N + 1):
        if body[i:i+N] in allref: run += 1; longest = max(longest, run)
        else: run = 0
    print(f"{os.path.basename(os.path.dirname(p)):34s} shared {N}-grams {ratio:6.2%}  longest shared run ~{longest + N - 1 if longest else 0} chars")
