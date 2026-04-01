import prisma from '@/lib/prisma';
import { sendEmail } from '@/lib/email/sendEmail';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || '';

export async function initiateApproval(params: {
  chainId: string;
  entityId: string;
  entityType: string;
  requestedById: string;
  organizationId: string | null;
  notes?: string;
}): Promise<string> {
  const { chainId, entityId, entityType, requestedById, organizationId, notes } = params;

  const chain = await prisma.approvalChain.findUnique({ where: { id: chainId } });
  if (!chain) throw new Error('Approval chain not found');

  const steps: Array<{ role?: string; userId?: string; order: number }> = Array.isArray(chain.steps)
    ? (chain.steps as any[])
    : [];

  const request = await prisma.approvalRequest.create({
    data: {
      chainId,
      entityId,
      entityType: entityType as any,
      currentStep: 0,
      status: 'PENDING',
      requestedById,
      organizationId,
      notes,
    },
  });

  // Create approval steps
  for (const step of steps) {
    await prisma.approvalStep.create({
      data: {
        requestId: request.id,
        stepOrder: step.order,
        assignedToId: step.userId || requestedById,
        status: 'PENDING',
      },
    });
  }

  // Notify first approver
  await notifyNextApprover(request.id);

  return request.id;
}

export async function processDecision(params: {
  requestId: string;
  stepId: string;
  decision: 'APPROVED' | 'REJECTED';
  comment?: string;
  userId: string;
}): Promise<'ADVANCED' | 'COMPLETED' | 'REJECTED'> {
  const { requestId, stepId, decision, comment, userId } = params;

  await prisma.approvalStep.update({
    where: { id: stepId },
    data: { status: decision, decidedAt: new Date(), comment },
  });

  if (decision === 'REJECTED') {
    await prisma.approvalRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED', completedAt: new Date() },
    });
    return 'REJECTED';
  }

  return advanceChain(requestId);
}

async function advanceChain(requestId: string): Promise<'ADVANCED' | 'COMPLETED'> {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: requestId },
    include: { steps: { orderBy: { stepOrder: 'asc' } } },
  });
  if (!request) throw new Error('Request not found');

  const nextPendingStep = request.steps.find(s => s.status === 'PENDING');

  if (!nextPendingStep) {
    // All steps approved
    await prisma.approvalRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED', completedAt: new Date() },
    });
    return 'COMPLETED';
  }

  await prisma.approvalRequest.update({
    where: { id: requestId },
    data: { currentStep: nextPendingStep.stepOrder },
  });

  await notifyNextApprover(requestId);
  return 'ADVANCED';
}

async function notifyNextApprover(requestId: string): Promise<void> {
  const request = await prisma.approvalRequest.findUnique({
    where: { id: requestId },
    include: {
      steps: { where: { status: 'PENDING' }, orderBy: { stepOrder: 'asc' }, take: 1 },
      requestedBy: { select: { email: true } },
    },
  });

  if (!request?.steps[0]) return;

  const step = request.steps[0];
  const assignee = await prisma.user.findUnique({ where: { id: step.assignedToId }, select: { email: true } });

  if (assignee?.email) {
    await sendEmail({
      to: assignee.email,
      template: 'approval-request',
      data: {
        entityType: request.entityType,
        entityId: request.entityId,
        requestedBy: request.requestedBy?.email,
        description: request.notes,
        approvalUrl: `${SITE_URL}/approvals/${requestId}`,
      },
    });
  }
}
