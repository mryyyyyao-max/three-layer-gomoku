import { key } from '../shared/board.js';

function cellMap(entries) {
  const cells = {};
  for (const [q, r, stack] of entries) cells[key(q, r)] = stack.slice();
  return cells;
}

const BAD_HIGHLIGHT = { q: 0, r: 0, color: 'rgba(180,40,40,0.35)' };

export function buildChapters() {
  return [
    {
      id: 'board',
      title: '棋盘与棋子',
      blurb: '六边形点位；深色先手、浅色后手；同一点可叠到三层。',
      frames: [
        { cells: cellMap([[2, 0, ['A']]]), holdMs: 900 },
        { cells: cellMap([[2, 0, ['A', 'B']]]), holdMs: 900 },
        { cells: cellMap([[2, 0, ['A', 'B', 'A']]]), holdMs: 1200 },
      ],
    },
    {
      id: 'layout',
      title: '布局阶段',
      blurb: '顺序 A1→B2→A2→B1；不可中心、不可与己邻。',
      frames: [
        { cells: {}, holdMs: 600 },
        { cells: cellMap([[3, 0, ['A']]]), holdMs: 800 },
        { cells: cellMap([[3, 0, ['A']], [-3, 0, ['B']]]), holdMs: 800 },
        {
          cells: cellMap([[3, 0, ['A']], [-3, 0, ['B']], [-3, 3, ['B']]]),
          holdMs: 800,
        },
        {
          cells: cellMap([[3, 0, ['A']], [-3, 0, ['B']], [-3, 3, ['B']]]),
          highlights: [BAD_HIGHLIGHT],
          holdMs: 900,
          flash: 'bad',
        },
        {
          cells: cellMap([
            [3, 0, ['A']],
            [-3, 0, ['B']],
            [-3, 3, ['B']],
            [0, 3, ['A']],
          ]),
          holdMs: 800,
        },
        {
          cells: cellMap([
            [3, 0, ['A']],
            [-3, 0, ['B']],
            [-3, 3, ['B']],
            [0, 3, ['A']],
            [0, -3, ['A']],
          ]),
          holdMs: 800,
        },
        {
          cells: cellMap([
            [3, 0, ['A']],
            [-3, 0, ['B']],
            [-3, 3, ['B']],
            [0, 3, ['A']],
            [0, -3, ['A']],
            [3, -3, ['B']],
          ]),
          holdMs: 1000,
        },
      ],
    },
    {
      id: 'place',
      title: '行动：放置',
      blurb: '行动阶段可向空位落子，中心也可。',
      frames: [
        {
          cells: cellMap([
            [3, 0, ['A']],
            [-3, 0, ['B']],
            [-3, 3, ['B']],
            [0, 3, ['A']],
            [0, -3, ['A']],
            [3, -3, ['B']],
          ]),
          holdMs: 700,
        },
        {
          cells: cellMap([
            [3, 0, ['A']],
            [-3, 0, ['B']],
            [-3, 3, ['B']],
            [0, 3, ['A']],
            [0, -3, ['A']],
            [3, -3, ['B']],
            [1, 0, ['A']],
          ]),
          holdMs: 800,
        },
        {
          cells: cellMap([
            [3, 0, ['A']],
            [-3, 0, ['B']],
            [-3, 3, ['B']],
            [0, 3, ['A']],
            [0, -3, ['A']],
            [3, -3, ['B']],
            [1, 0, ['A']],
            [0, 0, ['A']],
          ]),
          holdMs: 900,
          flash: 'ok',
        },
        {
          cells: cellMap([
            [3, 0, ['A']],
            [-3, 0, ['B']],
            [-3, 3, ['B']],
            [0, 3, ['A']],
            [0, -3, ['A']],
            [3, -3, ['B']],
            [1, 0, ['A']],
            [0, 0, ['A']],
            [-1, 1, ['B']],
          ]),
          holdMs: 800,
        },
      ],
    },
    {
      id: 'stack',
      title: '行动：移动与叠层',
      blurb: '只能平迁或下降一层；一层不能踩二层，二层不能落空地，三层只能上二层。',
      frames: [
        { cells: cellMap([[1, 0, ['A']], [2, 0, ['B']]]), holdMs: 700 },
        { cells: cellMap([[2, 0, ['B', 'A']]]), holdMs: 900, flash: 'ok' },
        {
          cells: cellMap([[0, 0, ['A', 'B']], [1, 0, ['A', 'B']]]),
          holdMs: 700,
        },
        {
          cells: cellMap([[0, 0, ['A', 'B', 'A']]]),
          holdMs: 900,
          flash: 'ok',
        },
        {
          cells: cellMap([[1, 0, ['A']], [2, 0, ['B', 'A']]]),
          highlights: [{ q: 2, r: 0, color: 'rgba(180,40,40,0.35)' }],
          holdMs: 900,
          flash: 'bad',
        },
        {
          cells: cellMap([[1, 0, ['A', 'B']]]),
          highlights: [{ q: 2, r: 0, color: 'rgba(180,40,40,0.35)' }],
          holdMs: 900,
          flash: 'bad',
        },
        {
          cells: cellMap([[1, 0, ['A', 'B', 'A']]]),
          highlights: [{ q: 2, r: 0, color: 'rgba(180,40,40,0.35)' }],
          holdMs: 900,
          flash: 'bad',
        },
      ],
    },
    {
      id: 'win-five',
      title: '胜法：俯视恰好五连',
      blurb: '只看顶层颜色，恰好五连获胜；六连不算。',
      frames: [
        {
          cells: cellMap([
            [-2, 0, ['A']],
            [-1, 0, ['A']],
            [0, 0, ['A']],
            [1, 0, ['A']],
          ]),
          holdMs: 700,
        },
        {
          cells: cellMap([
            [-2, 0, ['A']],
            [-1, 0, ['A']],
            [0, 0, ['A']],
            [1, 0, ['A']],
            [2, 0, ['A']],
          ]),
          highlights: [
            { q: -2, r: 0, color: 'rgba(80,160,80,0.45)' },
            { q: -1, r: 0, color: 'rgba(80,160,80,0.45)' },
            { q: 0, r: 0, color: 'rgba(80,160,80,0.45)' },
            { q: 1, r: 0, color: 'rgba(80,160,80,0.45)' },
            { q: 2, r: 0, color: 'rgba(80,160,80,0.45)' },
          ],
          holdMs: 1200,
          flash: 'ok',
        },
        {
          cells: cellMap([
            [-3, 0, ['A']],
            [-2, 0, ['A']],
            [-1, 0, ['A']],
            [0, 0, ['A']],
            [1, 0, ['A']],
            [2, 0, ['A']],
          ]),
          holdMs: 1000,
        },
      ],
    },
    {
      id: 'win-third-five',
      title: '胜法：第三层五枚',
      blurb: '至少五处「第三层顶为自己」即胜。',
      frames: [
        {
          cells: cellMap([
            [0, 0, ['B', 'B', 'A']],
            [1, 0, ['B', 'B', 'A']],
            [2, 0, ['B', 'B', 'A']],
          ]),
          holdMs: 700,
        },
        {
          cells: cellMap([
            [0, 0, ['B', 'B', 'A']],
            [1, 0, ['B', 'B', 'A']],
            [2, 0, ['B', 'B', 'A']],
            [0, 1, ['B', 'B', 'A']],
            [0, 2, ['B', 'B', 'A']],
          ]),
          highlights: [
            { q: 0, r: 0, color: 'rgba(80,160,80,0.45)' },
            { q: 1, r: 0, color: 'rgba(80,160,80,0.45)' },
            { q: 2, r: 0, color: 'rgba(80,160,80,0.45)' },
            { q: 0, r: 1, color: 'rgba(80,160,80,0.45)' },
            { q: 0, r: 2, color: 'rgba(80,160,80,0.45)' },
          ],
          holdMs: 1200,
          flash: 'ok',
        },
        {
          cells: cellMap([
            [0, 0, ['B', 'B', 'A']],
            [1, 0, ['B', 'B', 'A']],
            [2, 0, ['B', 'B', 'A']],
            [0, 1, ['B', 'B', 'A']],
            [0, 2, ['B', 'B', 'A']],
            [-1, 0, ['B', 'B', 'A']],
          ]),
          highlights: [
            { q: 0, r: 0, color: 'rgba(80,160,80,0.45)' },
            { q: 1, r: 0, color: 'rgba(80,160,80,0.45)' },
            { q: 2, r: 0, color: 'rgba(80,160,80,0.45)' },
            { q: 0, r: 1, color: 'rgba(80,160,80,0.45)' },
            { q: 0, r: 2, color: 'rgba(80,160,80,0.45)' },
          ],
          holdMs: 1000,
        },
      ],
    },
    {
      id: 'win-third-adj',
      title: '胜法：第三层三相邻',
      blurb: '己方第三层形成三格以上连通块即胜。',
      frames: [
        {
          cells: cellMap([[0, 0, ['B', 'B', 'A']]]),
          holdMs: 700,
        },
        {
          cells: cellMap([
            [0, 0, ['B', 'B', 'A']],
            [1, 0, ['B', 'B', 'A']],
          ]),
          holdMs: 700,
        },
        {
          cells: cellMap([
            [0, 0, ['B', 'B', 'A']],
            [1, 0, ['B', 'B', 'A']],
            [0, 1, ['B', 'B', 'A']],
          ]),
          highlights: [
            { q: 0, r: 0, color: 'rgba(80,160,80,0.45)' },
            { q: 1, r: 0, color: 'rgba(80,160,80,0.45)' },
            { q: 0, r: 1, color: 'rgba(80,160,80,0.45)' },
          ],
          holdMs: 1200,
          flash: 'ok',
        },
        {
          cells: cellMap([
            [0, 0, ['B', 'B', 'A']],
            [1, 0, ['B', 'B', 'A']],
            [0, 1, ['B', 'B', 'A']],
            [2, 0, ['B', 'B', 'B']],
          ]),
          holdMs: 800,
        },
      ],
    },
  ];
}
