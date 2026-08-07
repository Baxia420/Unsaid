export default async function (req: any, res: any) {
  try {
    const { createApp } = await import('../server/index.js');
    const app = createApp();
    return app(req, res);
  } catch (error: any) {
    res.status(500).json({
      error: 'Boot failed',
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  }
}
