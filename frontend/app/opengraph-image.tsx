import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = 'Flowboard — shared Kanban boards with card order that holds under concurrent drags';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const columns = [
  { name: 'To do', cards: [180, 120] },
  { name: 'Doing', cards: [150] },
  { name: 'Done', cards: [120, 170] },
];

export default async function OpengraphImage() {
  const icon = await readFile(join(process.cwd(), 'public/fb-icon.png'));
  const iconSrc = `data:image/png;base64,${icon.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          padding: '72px 80px',
          gap: 64,
          background: '#f3f5f8',
          color: '#0f1a24',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <img src={iconSrc} width={52} height={52} alt="" />
            <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>Flowboard</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -2.5, lineHeight: 1.04 }}>
              Make progress visible.
            </div>
            <div style={{ fontSize: 30, color: '#5b6878', lineHeight: 1.35 }}>
              Shared Kanban boards. Card order holds when two people drag at once.
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 24, color: '#5b6878' }}>Next.js · NestJS · Prisma · PostgreSQL</div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', alignSelf: 'center' }}>
          {columns.map((column, i) => (
            <div
              key={column.name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                width: 128,
                padding: 14,
                borderRadius: 16,
                background: '#eaeef3',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color: '#5b6878' }}>{column.name}</div>
              {column.cards.map((height, j) => (
                <div
                  key={j}
                  style={{
                    height: height / 2,
                    borderRadius: 10,
                    background: i === 1 ? '#d5ece8' : '#ffffff',
                    border: i === 1 ? '2px solid #0f766e' : '2px solid #e1e6ed',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
