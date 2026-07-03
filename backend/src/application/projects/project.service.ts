import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  CreateProjectDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { v4 as uuidv4 } from 'uuid';

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50);
}

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  // ──────────── Organizations ────────────

  async createOrganization(userId: string, dto: CreateOrganizationDto) {
    const slug = dto.slug ?? slugify(dto.name);

    const existing = await this.prisma.organization.findUnique({ where: { slug } });
    if (existing) throw new ConflictException(`Slug "${slug}" already taken`);

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        members: {
          create: { userId, role: 'OWNER' },
        },
      },
      include: { members: true },
    });

    return org;
  }

  async getOrganizations(userId: string) {
    return this.prisma.organization.findMany({
      where: { members: { some: { userId } } },
      include: { members: { include: { user: true } }, _count: { select: { projects: true } } },
    });
  }

  async getOrganization(userId: string, orgId: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, members: { some: { userId } } },
      include: {
        members: { include: { user: true } },
        projects: { include: { _count: { select: { queues: true } } } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async updateOrganization(userId: string, orgId: string, dto: UpdateOrganizationDto) {
    await this.assertOrgRole(userId, orgId, ['OWNER', 'ADMIN']);
    return this.prisma.organization.update({
      where: { id: orgId },
      data: dto,
    });
  }

  async deleteOrganization(userId: string, orgId: string) {
    await this.assertOrgRole(userId, orgId, ['OWNER']);
    await this.prisma.organization.delete({ where: { id: orgId } });
  }

  // ──────────── Projects ────────────

  async createProject(userId: string, orgId: string, dto: CreateProjectDto) {
    await this.assertOrgRole(userId, orgId, ['OWNER', 'ADMIN']);
    const slug = dto.slug ?? slugify(dto.name);

    const existing = await this.prisma.project.findUnique({
      where: { orgId_slug: { orgId, slug } },
    });
    if (existing) throw new ConflictException(`Project slug "${slug}" already exists in org`);

    return this.prisma.project.create({
      data: {
        orgId,
        name: dto.name,
        slug,
        description: dto.description,
        apiKey: uuidv4(),
        members: { create: { userId, role: 'OWNER' } },
      },
    });
  }

  async getProjects(userId: string, orgId: string) {
    await this.assertOrgRole(userId, orgId, ['OWNER', 'ADMIN', 'MEMBER']);
    return this.prisma.project.findMany({
      where: { orgId },
      include: {
        _count: { select: { queues: true } },
        members: { where: { userId }, select: { role: true } },
      },
    });
  }

  async getProject(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, members: { some: { userId } } },
      include: {
        queues: { include: { _count: { select: { jobs: true } } } },
        members: { include: { user: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async updateProject(userId: string, projectId: string, dto: UpdateProjectDto) {
    await this.assertProjectRole(userId, projectId, ['OWNER', 'ADMIN']);
    return this.prisma.project.update({ where: { id: projectId }, data: dto });
  }

  async deleteProject(userId: string, projectId: string) {
    await this.assertProjectRole(userId, projectId, ['OWNER']);
    await this.prisma.project.delete({ where: { id: projectId } });
  }

  async regenerateApiKey(userId: string, projectId: string) {
    await this.assertProjectRole(userId, projectId, ['OWNER', 'ADMIN']);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { apiKey: uuidv4() },
      select: { apiKey: true },
    });
  }

  // ──────────── Helpers ────────────

  private async assertOrgRole(userId: string, orgId: string, roles: string[]) {
    const member = await this.prisma.orgMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });
    if (!member || !roles.includes(member.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return member;
  }

  private async assertProjectRole(userId: string, projectId: string, roles: string[]) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (!member || !roles.includes(member.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return member;
  }
}
