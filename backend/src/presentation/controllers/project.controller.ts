import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ProjectService } from '../../application/projects/project.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  CreateProjectDto,
  UpdateProjectDto,
} from '../../application/projects/dto/project.dto';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @ApiOperation({ summary: 'Create organization' })
  create(@Request() req: any, @Body() dto: CreateOrganizationDto) {
    return this.projectService.createOrganization(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user organizations' })
  findAll(@Request() req: any) {
    return this.projectService.getOrganizations(req.user.id);
  }

  @Get(':orgId')
  @ApiOperation({ summary: 'Get organization by ID' })
  findOne(@Request() req: any, @Param('orgId') orgId: string) {
    return this.projectService.getOrganization(req.user.id, orgId);
  }

  @Put(':orgId')
  @ApiOperation({ summary: 'Update organization' })
  update(@Request() req: any, @Param('orgId') orgId: string, @Body() dto: UpdateOrganizationDto) {
    return this.projectService.updateOrganization(req.user.id, orgId, dto);
  }

  @Delete(':orgId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete organization' })
  remove(@Request() req: any, @Param('orgId') orgId: string) {
    return this.projectService.deleteOrganization(req.user.id, orgId);
  }

  // ──────── Projects within Org ────────

  @Post(':orgId/projects')
  @ApiOperation({ summary: 'Create project in organization' })
  createProject(@Request() req: any, @Param('orgId') orgId: string, @Body() dto: CreateProjectDto) {
    return this.projectService.createProject(req.user.id, orgId, dto);
  }

  @Get(':orgId/projects')
  @ApiOperation({ summary: 'List projects in organization' })
  getProjects(@Request() req: any, @Param('orgId') orgId: string) {
    return this.projectService.getProjects(req.user.id, orgId);
  }
}

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get(':projectId')
  @ApiOperation({ summary: 'Get project details' })
  findOne(@Request() req: any, @Param('projectId') projectId: string) {
    return this.projectService.getProject(req.user.id, projectId);
  }

  @Put(':projectId')
  @ApiOperation({ summary: 'Update project' })
  update(@Request() req: any, @Param('projectId') projectId: string, @Body() dto: UpdateProjectDto) {
    return this.projectService.updateProject(req.user.id, projectId, dto);
  }

  @Delete(':projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete project' })
  remove(@Request() req: any, @Param('projectId') projectId: string) {
    return this.projectService.deleteProject(req.user.id, projectId);
  }

  @Post(':projectId/regenerate-key')
  @ApiOperation({ summary: 'Regenerate project API key' })
  regenerateKey(@Request() req: any, @Param('projectId') projectId: string) {
    return this.projectService.regenerateApiKey(req.user.id, projectId);
  }
}
