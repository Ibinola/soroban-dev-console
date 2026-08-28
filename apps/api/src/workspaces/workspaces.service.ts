// backend/src/workspaces/workspaces.service.ts
async getSharedWorkspace(shareId: string) {
  const share = await this.workspaceShareRepository.findOne({ where: { id: shareId } });
  
  if (!share) {
    throw new NotFoundException('Share link not found');
  }

  if (share.expiresAt && new Date() > new Date(share.expiresAt)) {
    throw new GoneException('This workspace share link has expired');
  }

  return share;
}