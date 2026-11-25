import { getPwsResponse } from '../../../../lib/surface/pws-response';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return getPwsResponse(new URL(req.url).searchParams);
}
