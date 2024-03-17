/* eslint-disable no-console */
import domHelpers from '@/lib/domHelpers'
import utils from '@/services/utils'
import generalUtils from '@/lib/generalUtils'
import consts from '@/lib/constants'
/*
This module is for fetching assessments and accuracy questions of all the links
found on the current page.
*/
export default {
  namespaced: true,
  state: {
    linksAssessments: {},
    nonEmptyLinkAssessments: {},
  },
  getters: {

    linkAssessmentsBySources: (state, getters, rootState, rootGetters) =>
      (assessments, accuracyStatus, sources) => {
        const authUserId = rootGetters['auth/user'].id

        let sourcesIds
        if (sources === 'trusted')
          sourcesIds = rootGetters['relatedSources/trustedIds'].concat(authUserId)
        else if (sources === 'followed')
          sourcesIds = rootGetters['relatedSources/followedIds'].concat(authUserId)

        return assessments[accuracyStatus].map(assessment => assessment.SourceId).filter(sourceId =>
          sourcesIds.includes(sourceId))
      },

    isConfirmed: (state, getters) => (assessments) => {
      const confirmedByTrusted = getters.linkAssessmentsBySources(assessments, 'confirmed', 'trusted')
      const refutedByTrusted = getters.linkAssessmentsBySources(assessments, 'refuted', 'trusted')

      if (confirmedByTrusted.length || refutedByTrusted.length) {
        return confirmedByTrusted.length && !(refutedByTrusted.length)
      }
      else {
        const confirmedByFollowed = getters.linkAssessmentsBySources(assessments, 'confirmed', 'followed')
        const refutedByFollowed = getters.linkAssessmentsBySources(assessments, 'refuted', 'followed')
        return confirmedByFollowed.length && !(refutedByFollowed.length)
      }
    },
    isRefuted: (state, getters) => (assessments) => {
      const confirmedByTrusted = getters.linkAssessmentsBySources(assessments, 'confirmed', 'trusted')
      const refutedByTrusted = getters.linkAssessmentsBySources(assessments, 'refuted', 'trusted')

      if (confirmedByTrusted.length || refutedByTrusted.length) {
        return !(confirmedByTrusted.length) && refutedByTrusted.length
      }
      else {
        const confirmedByFollowed = getters.linkAssessmentsBySources(assessments, 'confirmed', 'followed')
        const refutedByFollowed = getters.linkAssessmentsBySources(assessments, 'refuted', 'followed')
        return !(confirmedByFollowed.length) && refutedByFollowed.length
      }
    },
    isDebated: (state, getters) => (assessments) => {
      const confirmedByTrusted = getters.linkAssessmentsBySources(assessments, 'confirmed', 'trusted')
      const refutedByTrusted = getters.linkAssessmentsBySources(assessments, 'refuted', 'trusted')

      if (confirmedByTrusted.length || refutedByTrusted.length) {
        return confirmedByTrusted.length && refutedByTrusted.length
      }
      else {
        const confirmedByFollowed = getters.linkAssessmentsBySources(assessments, 'confirmed', 'followed')
        const refutedByFollowed = getters.linkAssessmentsBySources(assessments, 'refuted', 'followed')
        return confirmedByFollowed.length && refutedByFollowed.length
      }
    },
    isQuestioned: state => (assessments) => {
      return assessments.questioned.length > 0
    },
  },
  mutations: {
    /*
        As a result of more elements being added to the page (e.g., while infinite scrolling), elements
        could be added that have the same links as the links that are already on the page (either in raw
        form or when sanitized). The assessments of these repeated links are fetched (under some occasions
        explained in the comments in the actions) whenever they are encountered again and the old assessments
        associated with these links are updated to what is returned most recently.
        */
    update_links_assessments(state, linksAssessments) {
      const oldLinksToRemain = Object.keys(state.linksAssessments).filter(key => !Object.keys(linksAssessments).includes(key))
      const preservedLinksAssessments = Object.keys(state.linksAssessments)
        .filter(key => oldLinksToRemain.includes(key))
        .reduce((obj, key) => {
          obj[key] = state.linksAssessments[key]
          return obj
        }, {})
      state.linksAssessments = Object.assign({}, preservedLinksAssessments, linksAssessments)

      const nonEmptyLinkAssessments = Object.fromEntries(Object.entries(linksAssessments).filter(([key, val]) =>
        val.confirmed.length || val.refuted.length || val.questioned.length,
      ))

      const nonEmptyOldLinksToRemain = Object.keys(state.nonEmptyLinkAssessments).filter(key => !Object.keys(nonEmptyLinkAssessments).includes(key))
      const nonEmptyPreservedLinksAssessments = Object.keys(state.nonEmptyLinkAssessments)
        .filter(key => nonEmptyOldLinksToRemain.includes(key))
        .reduce((obj, key) => {
          obj[key] = state.nonEmptyLinkAssessments[key]
          return obj
        }, {})
      state.nonEmptyLinkAssessments = Object.assign({}, nonEmptyPreservedLinksAssessments, nonEmptyLinkAssessments)
    },
    clear_links_assessments(state) {
      state.linkAssessments = {}
      state.nonEmptyLinkAssessments = {}
    },
  },
  actions: {

    setupLinkAssessments: (context) => {
      return new Promise((resolve, reject) => {
        const previousLinksFoundOnPage = Object.keys(context.state.linksAssessments)
        /*
                Get all the links on the page that in their raw form aren't exactly the same as the links
                for which we have already obtained assessments (we already have asessments for some links
                e.g., in the case that we are loading more links into the page, for instance, through infinite
                scrolling). This means that even if there are newer assessments for such links, they will not
                get updated.
                */
        const links = Array.from(new Set([...document.querySelectorAll('a')].filter(el => !el.parentNode.closest('[data-vuetify-trustnet]')).map(el =>
          el.getAttribute('href')).filter(el => el && !['/', '#'].includes(el) && el.substring(0, 7) !== 'mailto:' && !el.includes('javascript:void(0)')).filter(el =>
          !previousLinksFoundOnPage.includes(el),
        )))

        console.log('raw links found', links)

        /*
                Links that are newly added to the page but for which we already have fetched assessments
                */
        const prevNonEmptyLinks = Object.keys(context.state.nonEmptyLinkAssessments)
        /*
                Links that are newly appended to the page but whose href value is that same as a link for
                which we already have assessments. In this case, we do not request assessments again, but
                simply show these links with assessments we have already fetched.
                */
        const newRepeatedLinks = Array.from(new Set([...document.querySelectorAll('a')].filter(el =>
          !el.getAttribute('trustnet-modified-question-link')
                    && !el.getAttribute('trustnet-modified-link'),
        ).map(el =>
          el.getAttribute('href')).filter(el => el && !['/', '#'].includes(el) && el.substring(0, 7) !== 'mailto:').filter(el =>
          prevNonEmptyLinks.includes(el),
        )))

        console.log('previous links w assessments found on page', prevNonEmptyLinks)
        console.log('new repeated links', newRepeatedLinks)
        newRepeatedLinks.forEach((link) => {
          domHelpers.populateLinkAssessments(context.state.nonEmptyLinkAssessments[link])
        })

        /*
                Link sanitization. Relative links are made absolute by adding the protocol and the host name,
                and the query parameters are stripped off (except for the first query parameters on certain websites
                such as Facebook and Youtube that distinguish a resource using query parameters)
                After sanitization, some links may end up being the same. These are not filtered however, because
                we want to know which raw link a sanitized link pertains to (they will both share the same index
                in their corresponding arrays---links and sanitizedLinks). Later, when we fetch assessments for
                the sanitized links, the indices of the sanitized and raw links being the same helps in determining
                which raw links on the page to put the assessments next to.
                */
        let sanitizedLinks = links.map((url, index) => {
          let sanitizedUrl = url
          if (sanitizedUrl[0] === '.')
            sanitizedUrl = sanitizedUrl.substring(1, sanitizedUrl.length)
          if (sanitizedUrl.substring(0, 5) === '//www')
            sanitizedUrl = window.location.protocol + sanitizedUrl
          if (sanitizedUrl[0] === '/' || sanitizedUrl[0] === '?')
            sanitizedUrl = `${window.location.protocol}//${window.location.host}${sanitizedUrl}`
          if (sanitizedUrl[0] === '#')
            sanitizedUrl = utils.extractHostname(window.location.href, false) + sanitizedUrl

          return utils.extractHostname(sanitizedUrl, false)
        })

        // remove invalid urls both from sanitizedLinks and raw links arrays
        sanitizedLinks = sanitizedLinks.filter((url, index) => {
          if (utils.isValidHttpUrl(url)) {
            return true
          }
          else {
            links.splice(index, 1)
            return false
          }
        })

        const redirectedToSanitizedLinksMapping = {} // for all the links found on the page
        let allLinksAssessments = {}
        /*
                Ask the server for mappings of sanitized links already stored on the server and get their assessments
                Throughout the code, the links whose redirects are to be determined by the server (and then their assessments
                fetched) are sent via get requests in batches of 20 because there is a limit on the size of the http header.
                */
        const mappingReqProms = []
        let serverSentMappingsArr = []
        const serverSentMappings = {}
        for (let j = 0; j < sanitizedLinks.length; j += 20) {
          const iterationRequestedLinks = sanitizedLinks.slice(j, j + 20)

          mappingReqProms.push(
            browser.runtime.sendMessage({
              type: 'get_redirects',
              data: {
                headers: {
                  urls: JSON.stringify(iterationRequestedLinks.filter(link => link)),
                },
              },
            })
              .then((serverResponse) => {
                console.log('server response****', serverResponse)
                serverSentMappingsArr = serverSentMappingsArr.concat(serverResponse)

                const reFormattedMappings = {}
                for (let i = 0; i < serverResponse.length; i++) {
                  if (serverResponse[i] && serverResponse[i] !== 'failed') {
                    if (!(serverResponse[i] in reFormattedMappings))
                      reFormattedMappings[serverResponse[i]] = []

                    reFormattedMappings[serverResponse[i]].push(iterationRequestedLinks[i])
                  }
                }
                Object.assign(serverSentMappings, reFormattedMappings)

                // console.log('reformatted mappings', reFormattedMappings)

                context.dispatch('getAndShowAssessments', {
                  linksFragmentUnvisited: Object.keys(reFormattedMappings),
                  redirectedToSanitizedLinksMapping: reFormattedMappings,
                  sanitizedLinks,
                  rawLinks: links,
                })
                  .then((restructuredAssessments) => {
                    allLinksAssessments = Object.assign(allLinksAssessments, restructuredAssessments)
                  })
              }),
          )
        }

        // find sanitized links that were not sent by the server and follow their chain of redirects
        Promise.all(mappingReqProms)
          .then(() => {
            console.log('all server sent mappings are', serverSentMappings)
            console.log('non-null server sent mappings', sanitizedLinks.filter((link, index) =>
              serverSentMappingsArr[index] && serverSentMappingsArr[index] !== 'failed',
            ))
            // The remainder of those sanitized links for which the server did not have mappings to their ultimate links

            const sanitizedLinksRemainder = sanitizedLinks.filter((link, index) =>
              !serverSentMappingsArr[index] && serverSentMappingsArr[index] !== 'failed',
            ).filter(url => utils.isValidHttpUrl(url))

            console.log('The sanitized links for which the server does not have mappings', sanitizedLinksRemainder)
            Object.assign(redirectedToSanitizedLinksMapping, serverSentMappings)

            const allLinksProms = []
            /*
                    As examplained, sanitizedLinks can have duplicates (as explained above, two different raw links when sanitized,
                    will end up having the same value. But because when we insert assessments into the page, we look for the raw links,
                    we keep the mapping of both duplicate sanitized links to their corresponding raw links). But so that we do not
                    waste bandwidth and compute power on getting the tail of redirects or assessments for these duplicates, we create
                    an object of unique sanitized links with each key being a sanitized link and its corresponding value a boolean
                    indicating whether the link has been visited yet, with visited meaning its trail of redirects have been followed
                    and its assessments have been fetched.
                    */
            const uniqueSanitizedLinksVisited = Array.from(new Set(sanitizedLinksRemainder)).reduce((obj, x) =>
              Object.assign(obj, { [x]: 0 }), {})

            /*
                    The sanitized links can be redirects to other links. Therefore, they need to be followed and
                    their corresponding target link fetched so that assessments can be requested on the target links.
                    Their redirects are followed in batches of 20 at a time to prevent getting rate limited.
                    For each batch, becase sanitizedLinksRemainder can have duplicates, we check to see if we have already
                    visited the link by looking through uniqueSanitizedLinksVisited.
                    */

            const allAxiosProms = [] // Promises related to fetching the trail of redirects for all the sanitized links
            const unavailableResources = []
            const CORSBlockedLinks = []

            function clientFollowRedirects(i) {
              if (i < sanitizedLinksRemainder.length) {
                const iterationAxiosProms = [] // Promises related to fetching the trail of redirects for this iteration of sanitized links
                const iterationMappings = {}
                const linksFragment = sanitizedLinksRemainder.slice(i, i + 20)
                // console.log('client following redirects for slice', i)
                // console.log('link fragment is ', linksFragment)

                const linksFragmentUnvisited = linksFragment.filter((link) => {
                  if (uniqueSanitizedLinksVisited[link] === 0) {
                    uniqueSanitizedLinksVisited[link] = 1
                    const iterationProm = utils.followRedirects(link).then((response) => {
                      if (response.type === 'error') {
                        if (response.detail === '404')
                          unavailableResources.push(link)
                        /*
                                            Even though on chasing the redirects of some links we may have encountered a CORS issue,
                                            we nevertheless add the mapping of the redirected response to the original link. This mapping
                                            may or may not be final. For example, in the case of WashingtonPost articles, when we encounter
                                            a CORS issue, we already have the final URL. However, in the case of links to BBC or NYT on Facebook,
                                            because the links are shortened, we still do not have the final link when we encounter the CORS issue.
                                            All of these CORS blocked links will be later sent to the server so that the server can find the
                                            ultimate target link (since CORS is only imposed in browsers). We keep the mapping here nonetheless,
                                            because for paywalled articles, the server may not be able to get the redirected links (and rather
                                            get 403 for example).
                                            */
                        if (response.detail === 'CORS') {
                          const targetResource = utils.extractHostname(response.link)
                          if (!(targetResource in iterationMappings))
                            iterationMappings[targetResource] = []

                          iterationMappings[targetResource].push(link)
                          CORSBlockedLinks.push(link)
                        }
                        if (response.detail === 'Unknown')
                          CORSBlockedLinks.push(link)
                      }
                      if (response.type !== 'error') {
                        const targetResource = utils.extractHostname(response.link)
                        if (!(targetResource in iterationMappings))
                          iterationMappings[targetResource] = []

                        iterationMappings[targetResource].push(link)
                      }
                    })
                      .catch((errchi) => {
                        console.log('errchi', errchi)
                      })
                    iterationAxiosProms.push(iterationProm)
                    allAxiosProms.push(iterationProm)

                    return true
                  }
                  else { return false }
                })

                /*
                            Once redirects for this batch of sanitized links are followed and fetched by the client,
                            assessments are requested for the target links from the server and the assessments are placed
                            on the DOM.
                            */
                allLinksProms.push(
                  Promise.allSettled(iterationAxiosProms)
                    .then(() => {
                      Object.assign(redirectedToSanitizedLinksMapping, iterationMappings)

                      context.dispatch('getAndShowAssessments', {
                        linksFragmentUnvisited: Object.keys(iterationMappings),
                        redirectedToSanitizedLinksMapping: iterationMappings,
                        sanitizedLinks,
                        rawLinks: links,
                      })
                        .then((restructuredAssessments) => {
                          allLinksAssessments = Object.assign(allLinksAssessments, restructuredAssessments)
                        })
                    }),
                )

                i += 20

                const maxTime = ['twitter.com'].some(siteUrl =>
                  window.location.href.includes(siteUrl))
                  ? 130
                  : 70

                const randomWaitTime = generalUtils.randomInteger(10, maxTime)
                setTimeout(clientFollowRedirects(i), randomWaitTime)
              }
            }

            const i = 0
            clientFollowRedirects(i)

            /*
                    Inform the server of the redirects that it did not know about (and which were just fetched by the client)
                    so that it can store them. These mappings include redirectedToSanitizedLinksMapping but not the CORSBlockedLinks
                    (since they will be explicitly followed by the server later and then stored) and the initial links need
                    to be in sanitizedLinksRemainder (since sanitizedLinksRemainder is filtered to only include the links whose mapping
                    the server did not know)
                    */
            Promise.allSettled(allAxiosProms)
              .then(() => {
                const invereseLinkMapping = Object.keys(redirectedToSanitizedLinksMapping).reduce((ret, key) => {
                  ret[redirectedToSanitizedLinksMapping[key]] = key
                  return ret
                }, {})
                console.log('inverse link mapping (source to target) ', invereseLinkMapping)

                const mappingsToStore = Object.fromEntries(Object.entries(invereseLinkMapping).filter(([originLink, targetLink]) =>
                  !consts.DISALLOWED_DOMAINS.includes(utils.extractHostname(window.location.href), true)
                        && !CORSBlockedLinks.includes(originLink) && sanitizedLinksRemainder.includes(originLink)))

                // console.log('cors blocked links', CORSBlockedLinks)
                // console.log('mappings to store', mappingsToStore)

                if (Object.keys(mappingsToStore).length) {
                  browser.runtime.sendMessage({
                    type: 'send_redirects',
                    data: {
                      reqBody: {
                        urlMappings: JSON.stringify(mappingsToStore),
                      },
                    },
                  })
                    .then((resp) => {
                      console.log('posted redirects to the server', resp)
                    })
                    .catch((error) => {
                      console.log(`error encountered in posting redirects to be updated on the server ${error}`)
                    })
                }

                console.log('sending links that the client was unable to retrieve to the server', CORSBlockedLinks)

                /*
                        Once the redirects for all the sanitized links have been followed by the client, we send those
                        that the client could not check because of CORS issues to the server so that it can follow their
                        redirects and return the target links.
                        */
                const serverFollowedLinks = []

                for (let i = 0; i < CORSBlockedLinks.length; i += 20) {
                  const linksFragment = CORSBlockedLinks.slice(i, i + 20)
                  allLinksProms.push(
                    browser.runtime.sendMessage({
                      type: 'follow_redirects',
                      data: {
                        headers: {
                          urls: JSON.stringify(linksFragment),
                        },
                      },
                    })
                      .then((urlMapping) => {
                        context.dispatch('getAndShowAssessments', {
                          linksFragmentUnvisited: Object.keys(urlMapping),
                          redirectedToSanitizedLinksMapping: urlMapping,
                          sanitizedLinks,
                          rawLinks: links,
                        })
                          .then((restructuredAssessments) => {
                            allLinksAssessments = Object.assign(allLinksAssessments, restructuredAssessments)
                          })

                        serverFollowedLinks.push(Object.values(urlMapping))
                      }),
                  )
                }

                /*
                        For those links whose trail of redircts the server failed to fetch as well, we send the mapping that
                        the client has for them to the server. The server schedules to fetch them one last time and if it does
                        not succeed, store the client-sent mapping for them.
                        */
                const serverFailedLinks = CORSBlockedLinks.filter(x => !serverFollowedLinks.includes(x)) // links that the server failed to follow
                const failedMappingsToStore = {}

                // let invereseLinkMapping = Object.keys(redirectedToSanitizedLinksMapping).reduce((ret, key) => {
                //     ret[redirectedToSanitizedLinksMapping[key]] = key;
                //     return ret;}, {});

                console.log('links that both the client and the server failed to fetch', serverFailedLinks)
                for (const link of serverFailedLinks) {
                  if (link in invereseLinkMapping) // links that encountered CORS
                    failedMappingsToStore[link] = invereseLinkMapping[link]
                  else
                    failedMappingsToStore[link] = 'failed'
                }

                console.log('links sent to server to schedule following redirects for, and later storing', failedMappingsToStore)

                if (Object.entries(failedMappingsToStore).length) {
                  browser.runtime.sendMessage({
                    type: 'schedule_redirects',
                    data: {
                      reqBody: {
                        urlMappings: failedMappingsToStore,
                      },
                    },
                  })
                }

                /*
                        Once the assessments for all the links have been fetched, they are committed to the state.
                        The links for which there have been no assessments or questions are also committed because
                        when the page encounters a mutation and therefore the looking for links and assessments is
                        performed again, we do not want to perform the same operations for the previously encountered
                        links (which could be numerous) again and again.
                        */
                Promise.allSettled(allLinksProms)
                  .then(() => {
                    links.forEach((link) => {
                      if (!(link in allLinksAssessments))
                        allLinksAssessments[link] = { confirmed: [], refuted: [], questioned: [] }
                    })

                    context.commit('update_links_assessments', allLinksAssessments)
                    context.dispatch('pageObserver/reconnectObserver', {}, { root: true })

                    resolve()
                  })
              })
          })
          .catch((err) => {
            console.log(`error encountered in fetching mappings of links ${err}`)
          })
      })
    },

    getAndShowAssessments: (context, data) => {
      return new Promise((resolve, reject) => {
        context.dispatch('fetchAssessmentsForLinks', data)
          .then((response) => {
            return context.dispatch('restructureAssessments', {
              postsWAssessments: response.postsWAssessments,
              postsWQuestions: response.postsWQuestions,
              sanitizedLinks: data.sanitizedLinks,
              originalLinks: data.rawLinks,
              urlMapping: data.redirectedToSanitizedLinksMapping,
            })
          })
          .then((restructuredAssessments) => {
            console.log('What assessments this round of api calls returned', restructuredAssessments)
            console.log('these assessments were for the following links:', data.linksFragmentUnvisited)
            domHelpers.populateLinkAssessments(restructuredAssessments)
            resolve(restructuredAssessments)
          })
      })
    },

    fetchAssessmentsForLinks: (context, data) => {
      const linksFragmentUnvisited = data.linksFragmentUnvisited

      return new Promise((resolve, reject) => {
        /*
                for getting assessments of auth user's trusted and followed sources on the links
                */
        Promise.all([browser.runtime.sendMessage({
          type: 'get_assessments',
          data: {
            headers: {
              urls: JSON.stringify(linksFragmentUnvisited),
              excludeposter: true,
            },
          },
        }),
        /*
                for getting questions posted by the people who trust the auth user and have either
                specified the auth user as an arbiter of a question or have specified no one
                */
        browser.runtime.sendMessage({
          type: 'get_questions',
          data: {
            headers: { urls: JSON.stringify(linksFragmentUnvisited) },
          },
        })])
          .then(([postsWAssessments, postsWQuestions]) => {
            resolve({
              postsWAssessments,
              postsWQuestions,
            })
          })

          .catch((err) => {
            console.log(err)
            reject(err)
          })
      })
    },

    restructureAssessments: (context, data) => {
      const postsWAssessments = data.postsWAssessments
      const postsWQuestions = data.postsWQuestions
      const sanitizedLinks = data.sanitizedLinks
      const originalLinks = data.originalLinks
      const urlMapping = data.urlMapping

      return new Promise((resolve, reject) => {
        const linkAssessments = {}

        for (const postTuple of [{ assessments: postsWAssessments }, { questions: postsWQuestions }]) {
          Object.values(postTuple)[0].forEach((post) => {
            if (post.PostAssessments.length) {
              post.PostAssessments.forEach((assessment) => {
                if (assessment.version === 1) {
                  let credValue
                  if (Object.keys(postTuple)[0] === 'assessments')
                    credValue = utils.getAccuracyMapping(assessment.postCredibility)

                  else
                    credValue = 'questioned'

                  /*
                                    get all indices of post.url in sanitizedLinks (because sanitizedLinks can have duplicates)
                                    and using the indices, get their correponding raw links in the originalLinks array
                                    */
                  let clientSanitizedUrls

                  if (post.url in urlMapping) {
                    clientSanitizedUrls = (typeof urlMapping[post.url] == 'object') ? urlMapping[post.url] : [urlMapping[post.url]]
                  }
                  else {
                    const altUrls = utils.constructAltURLs([post.url])
                    const altUrl = altUrls.filter(url => url in urlMapping)[0]
                    clientSanitizedUrls = (typeof urlMapping[altUrl] == 'object') ? urlMapping[altUrl] : [urlMapping[altUrl]]
                  }

                  const protocolRemovedSanitizedLinks = sanitizedLinks.map((el) => {
                    return el.split('//')[1]
                  })
                  const protocolRemovedClientSanitizedUrls = clientSanitizedUrls.map(el => el.split('//')[1])

                  const originalLinkIndices = []
                  let sanitizedLinkIndex = -1

                  for (const protocolRemovedClientSanitizedUrl of protocolRemovedClientSanitizedUrls) {
                    do {
                      sanitizedLinkIndex = protocolRemovedSanitizedLinks.indexOf(protocolRemovedClientSanitizedUrl, sanitizedLinkIndex + 1)
                      if (sanitizedLinkIndex !== -1)
                        originalLinkIndices.push(sanitizedLinkIndex)
                    }
                    while (sanitizedLinkIndex !== -1)
                  }

                  /*
                                    Each instance of the raw links will be a key in linkAssessments mapped to its assessments
                                    */
                  originalLinkIndices.forEach((index) => {
                    const originalLink = originalLinks[index]
                    if (!(originalLink in linkAssessments))
                      linkAssessments[originalLink] = { confirmed: [], refuted: [], questioned: [] }

                    linkAssessments[originalLink][credValue].push(assessment)
                  })
                }
              })
            }
          })
        }

        resolve(linkAssessments)
      })
    },

    clearAssessments: (context) => {
      return new Promise((resolve, reject) => {
        context.commit('clear_links_assessments')
        resolve()
      })
    },

  },
}
