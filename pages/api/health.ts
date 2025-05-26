import { NextApiRequest, NextApiResponse } from "next";

const handler = (_req: NextApiRequest, res: NextApiResponse) => {
  try {
    // Basic health check response
    const healthData = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: "Personal AI Website",
      version: "1.0.0"
    };

    res.status(200).json(healthData);
  } catch (err: any) {
    res.status(503).json({ 
      status: "unhealthy",
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
};

export default handler; 