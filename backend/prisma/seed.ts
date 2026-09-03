import { PrismaPg } from '@prisma/adapter-pg';
import { BoardRole, PrismaClient } from '../src/generated/prisma/client';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://flowboard:flowboard@localhost:5432/flowboard?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log('Seed skipped: database already contains users.');
    return;
  }

  const owner = await prisma.user.create({
    data: {
      email: 'owner@example.com',
      name: 'Board Owner',
      passwordHash: 'dev-only-seed-password',
    },
  });

  const board = await prisma.board.create({
    data: {
      name: 'Project Board',
      ownerId: owner.id,
      members: {
        create: [{ userId: owner.id, role: BoardRole.OWNER }],
      },
      columns: {
        create: [
          { name: 'Backlog', position: 0 },
          { name: 'In Progress', position: 1 },
          { name: 'Done', position: 2 },
        ],
      },
    },
    include: { columns: true },
  });

  const backlog = board.columns.find((column) => column.name === 'Backlog');
  const inProgress = board.columns.find(
    (column) => column.name === 'In Progress',
  );

  if (backlog && inProgress) {
    await prisma.task.createMany({
      data: [
        {
          columnId: backlog.id,
          title: 'Draft feature brief',
          description: 'Outline scope',
          position: 0,
        },
        {
          columnId: backlog.id,
          title: 'Review API contract',
          description: 'Check required endpoints',
          position: 1,
        },
        {
          columnId: inProgress.id,
          title: 'Implement auth flow',
          description: 'Add login and session handling',
          position: 0,
        },
      ],
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
