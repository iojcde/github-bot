import type {EmitterWebhookEvent} from "@octokit/webhooks"
import {WHOAMI} from "../../settings"
import {addContributor} from "../../utils/addContributor"
import {ParsedRepo} from "../../utils/helpers"
import log from "../../utils/log"
import octokit from "../../utils/octokit"
import {getContributions} from "./getContributions"

export const pull_requestClosed = async ({
  payload: {pull_request, repository},
}: EmitterWebhookEvent<"pull_request.closed">) => {
  const repo = ParsedRepo.fromFullRepo(repository)

  const isBot = pull_request.user.type.toLowerCase() === "bot" || pull_request.user.login === WHOAMI
  const isTargetDefaultBranch = pull_request.head.repo.default_branch === pull_request.base.ref
  const fileChanged = pull_request.changed_files
  const wasMerged = pull_request.merged

  if (isBot || !isTargetDefaultBranch || fileChanged === 0 || !wasMerged) {
    return
  }

  const contributions = await getContributions({
    repo,
    pr: pull_request.number,
  })

  log.info(`Contributions of @${pull_request.user.login}: ` + contributions.join(", ") || "none")

  if (contributions.length === 0) return

  const contributionMsg = await addContributor({
    contributor: pull_request.user.login,
    contributions,
  })

  if (contributionMsg) {
    log.info(contributionMsg)
    await octokit.issues.createComment({
      ...repo,
      issue_number: pull_request.number,
      body: contributionMsg,
    })
  }
}
