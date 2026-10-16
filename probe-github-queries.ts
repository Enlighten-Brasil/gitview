/**
 * Probe (não-commitado): valida que os queries revisados de #6 são aceitos
 * pela API real — reviewCount + pageInfo no PR_QUERY e o REVIEWS_QUERY com
 * number: Int!. Roda contra o PR mais "pesado" do dataset e um conhecido.
 */
import { ghGraphql, getToken } from './scripts/lib/github'

const auth = getToken()
if (!auth) {
  console.log('sem token — pulando probe')
  process.exit(0)
}

const PR_QUERY = `
query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: 5, states: [MERGED], orderBy: { field: UPDATED_AT, direction: DESC }) {
      nodes {
        number title state mergedAt
        author { login }
        reviewCount { totalCount }
        reviews(first: 100, orderBy: { field: CREATED_AT, direction: ASC }) {
          nodes { author { login } state submittedAt }
          pageInfo { hasNextPage endCursor }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
  rateLimit { remaining }
}`

const REVIEWS_QUERY = `
query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviews(first: 100, after: $cursor, orderBy: { field: CREATED_AT, direction: ASC }) {
        nodes { author { login } state submittedAt }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`

const data = await ghGraphql<any>(PR_QUERY, { owner: 'Enlighten-Brasil', name: 'en-space' }, auth.token)
const nodes = data.repository.pullRequests.nodes
console.log('PR_QUERY ok — primeiro:', JSON.stringify({ n: nodes[0]?.number, reviewCount: nodes[0]?.reviewCount, inline: nodes[0]?.reviews?.nodes?.length, hasNext: nodes[0]?.reviews?.pageInfo?.hasNextPage }))

if (nodes[0]?.number) {
  const r2 = await ghGraphql<any>(REVIEWS_QUERY, { owner: 'Enlighten-Brasil', name: 'en-space', number: nodes[0].number }, auth.token)
  const rr = r2.repository.pullRequest.reviews
  console.log('REVIEWS_QUERY ok — nodes:', rr.nodes.length, 'hasNextPage:', rr.pageInfo.hasNextPage)
}
console.log('rate remaining:', data.rateLimit.remaining)
