import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import {
  BoardRole,
  PrismaClient,
  TaskPriority,
} from '../src/generated/prisma/client.js';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://flowboard:flowboard@localhost:5432/flowboard?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

type SeedAssignee = 'owner' | 'designer' | 'engineer' | 'writer';

type SeedColumn = {
  name: string;
  tasks: Array<{
    title: string;
    description: string;
    priority?: TaskPriority;
    dueInDays?: number;
    assignee?: SeedAssignee;
  }>;
};

function utcDateFromToday(dayOffset: number) {
  const today = new Date();

  return new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() + dayOffset,
    ),
  );
}

async function createSeedBoard({
  ownerId,
  name,
  memberIds = [],
  assigneeIds,
  columns,
}: {
  ownerId: string;
  name: string;
  memberIds?: string[];
  assigneeIds: Record<SeedAssignee, string>;
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

  const boardUserIds = [ownerId, ...memberIds];

  await prisma.task.createMany({
    data: columns.flatMap((column, columnIndex) => {
      const createdColumn = board.columns.find(
        (entry) => entry.position === columnIndex,
      );

      return column.tasks.map((task, position) => {
        const assigneeId = task.assignee ? assigneeIds[task.assignee] : null;

        if (assigneeId && !boardUserIds.includes(assigneeId)) {
          throw new Error(
            `Seed task "${task.title}" is assigned to a non-member of ${name}.`,
          );
        }

        return {
          columnId: createdColumn!.id,
          title: task.title,
          description: task.description,
          position,
          priority: task.priority ?? TaskPriority.MEDIUM,
          dueDate:
            task.dueInDays === undefined
              ? null
              : utcDateFromToday(task.dueInDays),
          assigneeId,
        };
      });
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

  const assigneeIds: Record<SeedAssignee, string> = {
    owner: owner.id,
    designer: designer.id,
    engineer: engineer.id,
    writer: writer.id,
  };

  await createSeedBoard({
    ownerId: owner.id,
    name: 'Project Board',
    memberIds: [designer.id, engineer.id, writer.id],
    assigneeIds,
    columns: [
      {
        name: 'Backlog',
        tasks: [
          {
            title: 'Draft feature brief',
            description:
              'Outline scope, success criteria, and launch assumptions.',
            priority: TaskPriority.HIGH,
            dueInDays: 3,
            assignee: 'owner',
          },
          {
            title: 'Review API contract',
            description:
              'Check required endpoints and error response behavior.',
            priority: TaskPriority.URGENT,
            dueInDays: -2,
            assignee: 'engineer',
          },
          {
            title: 'Collect customer interview notes',
            description: 'Group recurring workflow problems into themes.',
            priority: TaskPriority.LOW,
            assignee: 'writer',
          },
          {
            title: 'Plan the first onboarding experiment',
            description: 'Define the audience, hypothesis, and success metric.',
            priority: TaskPriority.MEDIUM,
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
            priority: TaskPriority.URGENT,
            dueInDays: 0,
            assignee: 'engineer',
          },
          {
            title: 'Polish responsive board layout',
            description:
              'Check the board at desktop, tablet, and mobile widths.',
            priority: TaskPriority.MEDIUM,
            dueInDays: 2,
            assignee: 'designer',
          },
          {
            title: 'Build member management panel',
            description:
              'Show roles, avatars, add-member feedback, and removal states.',
            priority: TaskPriority.HIGH,
            dueInDays: -1,
            assignee: 'engineer',
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
            priority: TaskPriority.HIGH,
            dueInDays: 1,
            assignee: 'designer',
          },
          {
            title: 'Check empty and error states',
            description:
              'Make every network state explain what the user can do next.',
            priority: TaskPriority.LOW,
            assignee: 'writer',
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
            priority: TaskPriority.MEDIUM,
            assignee: 'engineer',
          },
          {
            title: 'Add dense task ordering',
            description: 'Keep task positions contiguous after every move.',
            priority: TaskPriority.HIGH,
            assignee: 'engineer',
          },
          {
            title: 'Create the first board shell',
            description:
              'Establish the workspace navigation and board surface.',
            priority: TaskPriority.LOW,
          },
        ],
      },
    ],
  });

  await createSeedBoard({
    ownerId: owner.id,
    name: 'Website Launch',
    memberIds: [designer.id, writer.id],
    assigneeIds,
    columns: [
      {
        name: 'Ideas',
        tasks: [
          {
            title: 'Homepage headline directions',
            description:
              'Explore three clear ways to explain the product value.',
            priority: TaskPriority.MEDIUM,
            dueInDays: 5,
            assignee: 'designer',
          },
          {
            title: 'Customer proof section',
            description:
              'Choose the strongest outcomes to feature near the top.',
            priority: TaskPriority.LOW,
          },
        ],
      },
      {
        name: 'Writing',
        tasks: [
          {
            title: 'Product overview copy',
            description: 'Write concise copy for the primary product sections.',
            priority: TaskPriority.HIGH,
            dueInDays: -1,
            assignee: 'writer',
          },
          {
            title: 'Release announcement',
            description: 'Prepare the launch note and a short social version.',
            priority: TaskPriority.URGENT,
            dueInDays: 4,
            assignee: 'owner',
          },
          {
            title: 'FAQ content review',
            description:
              'Remove jargon and answer the questions new users actually ask.',
            priority: TaskPriority.MEDIUM,
            assignee: 'writer',
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
            priority: TaskPriority.HIGH,
            dueInDays: -2,
            assignee: 'designer',
          },
        ],
      },
    ],
  });

  await createSeedBoard({
    ownerId: designer.id,
    name: "Maya's Design Studio",
    memberIds: [owner.id, engineer.id],
    assigneeIds,
    columns: [
      {
        name: 'Reference',
        tasks: [
          {
            title: 'Audit current visual language',
            description:
              'Capture patterns worth keeping and places that need refinement.',
            priority: TaskPriority.MEDIUM,
            assignee: 'designer',
          },
          {
            title: 'Collect interaction examples',
            description:
              'Save examples of polished menus, dialogs, and empty states.',
            priority: TaskPriority.LOW,
            dueInDays: 6,
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
            priority: TaskPriority.HIGH,
            dueInDays: 0,
            assignee: 'owner',
          },
          {
            title: 'Task card density study',
            description:
              'Find the balance between glanceable cards and useful detail.',
            priority: TaskPriority.MEDIUM,
            dueInDays: 3,
            assignee: 'engineer',
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
            priority: TaskPriority.URGENT,
            dueInDays: -3,
            assignee: 'designer',
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
