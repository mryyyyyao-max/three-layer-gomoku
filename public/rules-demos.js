import { key } from '../shared/board.js';

function cellMap(entries) {
  const cells = {};
  for (const [q, r, stack] of entries) cells[key(q, r)] = stack.slice();
  return cells;
}

const RED = 'rgba(180,40,40,0.4)';
const GREEN = 'rgba(80,160,80,0.45)';

const LAYOUT_DONE = [
  [3, 0, ['A']],
  [-3, 0, ['B']],
  [-3, 3, ['B']],
  [0, 3, ['A']],
  [0, -3, ['A']],
  [3, -3, ['B']],
];

export function buildChapters() {
  return [
    {
      id: 'board',
      title: '棋盘与棋子',
      blurb: '交点落子；深色先手、浅色后手。同一点可叠到三层（下图从左到右：一层 / 二层 / 三层）。',
      static: true,
      frames: [
        {
          cells: cellMap([
            [-2, 1, ['A']],
            [0, 0, ['A', 'B']],
            [2, -1, ['A', 'B', 'A']],
          ]),
          caption: '一层 · 二层 · 三层',
          holdMs: 1000,
        },
      ],
    },
    {
      id: 'layout',
      title: '布局阶段',
      blurb: '顺序：先手 1 → 后手 2 → 先手 2 → 后手 1。不可落中心，不可与己方已有棋相邻。',
      frames: [
        {
          cells: {},
          turn: 'A',
          step: 'Step 1 · 先手落 1 子',
          caption: '轮到先手（深色）',
          holdMs: 1600,
        },
        {
          cells: cellMap([[3, 0, ['A']]]),
          turn: 'A',
          step: 'Step 1 · 先手落 1 子',
          caption: '啪 · 先手落下第 1 子',
          holdMs: 1800,
        },
        {
          cells: cellMap([[3, 0, ['A']]]),
          turn: 'B',
          step: 'Step 2 · 后手落 2 子',
          caption: '轮到后手（浅色）· 要连落两子',
          holdMs: 1600,
        },
        {
          cells: cellMap([[3, 0, ['A']], [-3, 0, ['B']]]),
          turn: 'B',
          step: 'Step 2 · 后手落 2 子',
          caption: '啪 · 后手第 1 子',
          holdMs: 700,
        },
        {
          cells: cellMap([[3, 0, ['A']], [-3, 0, ['B']], [-3, 3, ['B']]]),
          turn: 'B',
          step: 'Step 2 · 后手落 2 子',
          caption: '啪啪 · 后手第 2 子',
          holdMs: 1800,
        },
        {
          cells: cellMap([[3, 0, ['A']], [-3, 0, ['B']], [-3, 3, ['B']]]),
          turn: 'A',
          step: '提示',
          caption: '注意禁手',
          tip: '不可以下中心',
          highlights: [{ q: 0, r: 0, color: RED }],
          flash: 'bad',
          holdMs: 2200,
        },
        {
          cells: cellMap([[3, 0, ['A']], [-3, 0, ['B']], [-3, 3, ['B']]]),
          turn: 'A',
          step: '提示',
          caption: '注意禁手',
          tip: '不可以下在己方相邻格',
          highlights: [{ q: 2, r: 0, color: RED }],
          flash: 'bad',
          holdMs: 2200,
        },
        {
          cells: cellMap([[3, 0, ['A']], [-3, 0, ['B']], [-3, 3, ['B']]]),
          turn: 'A',
          step: 'Step 3 · 先手落 2 子',
          caption: '轮到先手 · 连落两子',
          holdMs: 1400,
        },
        {
          cells: cellMap([
            [3, 0, ['A']],
            [-3, 0, ['B']],
            [-3, 3, ['B']],
            [0, 3, ['A']],
          ]),
          turn: 'A',
          step: 'Step 3 · 先手落 2 子',
          caption: '啪 · 先手第 1 子',
          holdMs: 700,
        },
        {
          cells: cellMap([
            [3, 0, ['A']],
            [-3, 0, ['B']],
            [-3, 3, ['B']],
            [0, 3, ['A']],
            [0, -3, ['A']],
          ]),
          turn: 'A',
          step: 'Step 3 · 先手落 2 子',
          caption: '啪啪 · 先手第 2 子',
          holdMs: 1800,
        },
        {
          cells: cellMap([
            [3, 0, ['A']],
            [-3, 0, ['B']],
            [-3, 3, ['B']],
            [0, 3, ['A']],
            [0, -3, ['A']],
          ]),
          turn: 'B',
          step: 'Step 4 · 后手落 1 子',
          caption: '轮到后手落最后 1 子',
          holdMs: 1400,
        },
        {
          cells: cellMap(LAYOUT_DONE),
          turn: 'B',
          step: 'Step 4 · 后手落 1 子',
          caption: '啪 · 布局完成，进入行动阶段',
          holdMs: 2000,
        },
      ],
    },
    {
      id: 'place',
      title: '行动：放置',
      blurb: '布局结束后轮流行动。放置：向空位落子（此时中心也可以）。双方交替，每人每次只落一子。',
      frames: [
        {
          cells: cellMap(LAYOUT_DONE),
          turn: 'A',
          step: '行动 · 先手',
          caption: '接布局终局 · 轮到先手放置',
          holdMs: 1800,
        },
        {
          cells: cellMap([...LAYOUT_DONE, [1, -1, ['A']]]),
          turn: 'A',
          step: '行动 · 先手',
          caption: '啪 · 先手在空位落 1 子',
          holdMs: 1600,
        },
        {
          cells: cellMap([...LAYOUT_DONE, [1, -1, ['A']]]),
          turn: 'B',
          step: '行动 · 后手',
          caption: '换后手',
          holdMs: 1400,
        },
        {
          cells: cellMap([...LAYOUT_DONE, [1, -1, ['A']], [-1, 0, ['B']]]),
          turn: 'B',
          step: '行动 · 后手',
          caption: '啪 · 后手落 1 子',
          holdMs: 1600,
        },
        {
          cells: cellMap([...LAYOUT_DONE, [1, -1, ['A']], [-1, 0, ['B']]]),
          turn: 'A',
          step: '提示',
          caption: '行动阶段中心可下',
          tip: '中心现在可以落子',
          highlights: [{ q: 0, r: 0, color: GREEN }],
          flash: 'ok',
          holdMs: 2000,
        },
        {
          cells: cellMap([
            ...LAYOUT_DONE,
            [1, -1, ['A']],
            [-1, 0, ['B']],
            [0, 0, ['A']],
          ]),
          turn: 'A',
          step: '行动 · 先手',
          caption: '啪 · 先手落在中心',
          holdMs: 1800,
        },
      ],
    },
    {
      id: 'stack',
      title: '行动：移动与叠层',
      blurb: '只能移动自己的堆顶。合法：平迁或下降恰好一层。非法时会弹出原因。',
      frames: [
        {
          cells: cellMap([[1, 0, ['A']], [2, 0, ['B']]]),
          turn: 'A',
          step: '合法 · 一层叠一层',
          caption: '先手要把一层叠到相邻一层上',
          holdMs: 1600,
        },
        {
          cells: cellMap([[2, 0, ['B', 'A']]]),
          turn: 'A',
          step: '合法 · 一层叠一层',
          caption: '啪 · 变成二层 · 可以',
          flash: 'ok',
          holdMs: 1800,
        },
        {
          cells: cellMap([[0, 0, ['A', 'B']], [1, 0, ['A', 'B']]]),
          turn: 'A',
          step: '合法 · 二层叠二层',
          caption: '两个二层相邻 · 先手可叠成三层',
          holdMs: 1600,
        },
        {
          cells: cellMap([[0, 0, ['A', 'B', 'A']]]),
          turn: 'A',
          step: '合法 · 二层叠二层',
          caption: '啪 · 二层叠二层成三层 · 可以',
          flash: 'ok',
          holdMs: 1800,
        },
        {
          cells: cellMap([[1, 0, ['A']], [2, 0, ['B', 'A']]]),
          turn: 'A',
          step: '非法',
          caption: '一层想踩到二层上？',
          tip: '一层不能踩到二层上',
          highlights: [{ q: 2, r: 0, color: RED }],
          flash: 'bad',
          holdMs: 2400,
        },
        {
          cells: cellMap([[1, 0, ['A', 'B']]]),
          turn: 'A',
          step: '非法',
          caption: '二层旁边空地标红',
          tip: '二层不能落到空地（只能到一层或二层）',
          highlights: [{ q: 2, r: 0, color: RED }],
          flash: 'bad',
          holdMs: 2400,
        },
        {
          cells: cellMap([[1, 0, ['A', 'B', 'A']], [2, 0, ['B']]]),
          turn: 'A',
          step: '非法',
          caption: '三层顶想落到一层上？',
          tip: '三层只能落到二层上',
          highlights: [{ q: 2, r: 0, color: RED }],
          flash: 'bad',
          holdMs: 2400,
        },
        {
          cells: cellMap([[1, 0, ['A', 'B', 'A']]]),
          turn: 'A',
          step: '非法',
          caption: '三层顶旁边空地标红',
          tip: '三层只能落到二层上',
          highlights: [{ q: 2, r: 0, color: RED }],
          flash: 'bad',
          holdMs: 2400,
        },
      ],
    },
    {
      id: 'wins',
      title: '三种胜法',
      blurb: '任一达成即胜。以下为静止示意（俯视看顶层颜色）。',
      layout: 'row',
      panels: [
        {
          id: 'win-five',
          title: '俯视恰好五连',
          blurb: '顶层同色恰好 5 连；6 连不算胜。',
          frames: [
            {
              cells: cellMap([
                [-2, 0, ['A']],
                [-1, 0, ['A']],
                [0, 0, ['A']],
                [1, 0, ['A']],
                [2, 0, ['A']],
              ]),
              highlights: [
                { q: -2, r: 0, color: GREEN },
                { q: -1, r: 0, color: GREEN },
                { q: 0, r: 0, color: GREEN },
                { q: 1, r: 0, color: GREEN },
                { q: 2, r: 0, color: GREEN },
              ],
              caption: '恰好五连 · 胜',
              holdMs: 1000,
            },
          ],
        },
        {
          id: 'win-third-five',
          title: '第三层五枚',
          blurb: '至少 5 处「第三层顶为自己」。',
          frames: [
            {
              cells: cellMap([
                [0, 0, ['B', 'B', 'A']],
                [1, 0, ['B', 'B', 'A']],
                [2, 0, ['B', 'B', 'A']],
                [0, 1, ['B', 'B', 'A']],
                [0, 2, ['B', 'B', 'A']],
              ]),
              highlights: [
                { q: 0, r: 0, color: GREEN },
                { q: 1, r: 0, color: GREEN },
                { q: 2, r: 0, color: GREEN },
                { q: 0, r: 1, color: GREEN },
                { q: 0, r: 2, color: GREEN },
              ],
              caption: '五处第三层 · 胜',
              holdMs: 1000,
            },
          ],
        },
        {
          id: 'win-third-adj',
          title: '第三层三相邻',
          blurb: '己方第三层连通块 ≥ 3。',
          frames: [
            {
              cells: cellMap([
                [0, 0, ['B', 'B', 'A']],
                [1, 0, ['B', 'B', 'A']],
                [0, 1, ['B', 'B', 'A']],
              ]),
              highlights: [
                { q: 0, r: 0, color: GREEN },
                { q: 1, r: 0, color: GREEN },
                { q: 0, r: 1, color: GREEN },
              ],
              caption: '三格连通 · 胜',
              holdMs: 1000,
            },
          ],
        },
      ],
    },
  ];
}
