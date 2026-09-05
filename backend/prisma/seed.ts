import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import { BoardRole, PrismaClient } from '../src/generated/prisma/client.ts';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://flowboard:flowboard@localhost:5432/flowboard?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

type SeedColumn = {
  name: string;
  tasks: Array<{ title: string; description: string }>;
};

async function createSeedBoard({
  ownerId,
  name,
  memberIds = [],
  columns,
}: {
  ownerId: string;
  name: string;
  memberIds?: string[];
  columns: SeedColumn[];
}) {
  const board = await prisma.board.create({
    data: {
      name,
      ownerId,
      members: {
        create: [
          { userId: ownerId, role: BoardRole.OWNER },
          ...memberIds.map((userId) => ({ userId, role: BoardRole.MEMBER })),
        ],
      },
      columns: {
        create: columns.map((column, position) => ({
          name: column.name,
          position,
        })),
      },
    },
    include: { columns: true },
  });

  await prisma.task.createMany({
    data: columns.flatMap((column, columnIndex) => {
      const createdColumn = board.columns.find(
        (entry) => entry.position === columnIndex,
      );

      return column.tasks.map((task, position) => ({
        columnId: createdColumn!.id,
        title: task.title,
        description: task.description,
        position,
      }));
    }),
  });

  return board;
}

async function main() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log('Seed skipped: database already contains users.');
    return;
  }

  const passwordHash = await bcrypt.hash('FlowboardDemo123!', 12);
  const [owner, designer, engineer, writer] = await Promise.all([
    prisma.user.create({
      data: { email: 'owner@example.com', name: 'Board Owner', passwordHash },
    }),
    prisma.user.create({
      data: {
        email: 'designer@example.com',
        name: 'Maya Chen',
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        email: 'engineer@example.com',
        name: 'Alex Morgan',
        passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        email: 'writer@example.com',
        name: 'Jordan Rivera',
        passwordHash,
      },
    }),
  ]);

  await createSeedBoard({
    ownerId: owner.id,
    name: 'Project Board',
    memberIds: [designer.id, engineer.id, writer.id],
    columns: [
      {
        name: 'Backlog',
        tasks: [
          {
            title: 'Draft feature brief',
            description:
              'Outline scope, success criteria, and launch assumptions.',
          },
          {
            title: 'Review API contract',
            description:
              'Check required endpoints and error response behavior.',
          },
          {
            title: 'Collect customer interview notes',
            description: 'Group recurring workflow problems into themes.',
          },
          {
            title: 'Plan the first onboarding experiment',
            description: 'Define the audience, hypothesis, and success metric.',
          },
        ],
      },
      {
        name: 'In Progress',
        tasks: [
          {
            title: 'Implement auth flow',
            description:
              'Add login, registration, session recovery, and validation.',
          },
          {
            title: 'Polish responsive board layout',
            description:
              'Check the board at desktop, tablet, and mobile widths.',
          },
          {
            title: 'Build member management panel',
            description:
              'Show roles, avatars, add-member feedback, and removal states.',
          },
        ],
      },
      {
        name: 'Review',
        tasks: [
          {
            title: 'Accessibility pass for dialogs',
            description:
              'Verify focus, Escape handling, labels, and live feedback.',
          },
          {
            title: 'Check empty and error states',
            description:
              'Make every network state explain what the user can do next.',
          },
        ],
      },
      {
        name: 'Done',
        tasks: [
          {
            title: 'Set up local PostgreSQL workflow',
            description:
              'Document Compose, migrations, seed, and local service startup.',
          },
          {
            title: 'Add dense task ordering',
            description: 'Keep task positions contiguous after every move.',
          },
          {
            title: 'Create the first board shell',
            description:
              'Establish the workspace navigation and board surface.',
          },
        ],
      },
    ],
  });

  await createSeedBoard({
    ownerId: owner.id,
    name: 'Website Launch',
    memberIds: [designer.id, writer.id],
    columns: [
      {
        name: 'Ideas',
        tasks: [
          {
            title: 'Homepage headline directions',
            description:
              'Explore three clear ways to explain the product value.',
          },
          {
            title: 'Customer proof section',
            description:
              'Choose the strongest outcomes to feature near the top.',
          },
        ],
      },
      {
        name: 'Writing',
        tasks: [
          {
            title: 'Product overview copy',
            description: 'Write concise copy for the primary product sections.',
          },
          {
            title: 'Release announcement',
            description: 'Prepare the launch note and a short social version.',
          },
          {
            title: 'FAQ content review',
            description:
              'Remove jargon and answer the questions new users actually ask.',
          },
        ],
      },
      {
        name: 'Ready to publish',
        tasks: [
          {
            title: 'Final responsive QA',
            description:
              'Review typography, spacing, and interactions on small screens.',
          },
        ],
      },
    ],
  });

  await createSeedBoard({
    ownerId: designer.id,
    name: "Maya's Design Studio",
    memberIds: [owner.id, engineer.id],
    columns: [
      {
        name: 'Reference',
        tasks: [
          {
            title: 'Audit current visual language',
            description:
              'Capture patterns worth keeping and places that need refinement.',
          },
          {
            title: 'Collect interaction examples',
            description:
              'Save examples of polished menus, dialogs, and empty states.',
          },
        ],
      },
      {
        name: 'Exploring',
        tasks: [
          {
            title: 'Board header alternatives',
            description:
              'Compare member facepiles, actions, and metadata hierarchy.',
          },
          {
            title: 'Task card density study',
            description:
              'Find the balance between glanceable cards and useful detail.',
          },
        ],
      },
      {
        name: 'Selected',
        tasks: [
          {
            title: 'Refine spacing tokens',
            description:
              'Align card, column, modal, and sidebar spacing decisions.',
          },
        ],
      },
    ],
  });

  console.log('Seed complete: 4 users, 3 boards, 10 columns, and 23 tasks.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
