/* eslint-disable no-console */
import sourceServices from '~/services/sourceServices'
import utils from '~/services/utils'

export default {
  namespaced: true,
  state: {
    isExpanded: false,
    expanderIsDisplayed: true,
    assessments: { confirmed: [], refuted: [], questioned: [] },
    userAssessment: {},
    postOwnerAssessment: {},
    historyVisibility: false,
    assessmentHistory: [],
    historyOwner: {},
    unfollowedAssessorsOnPage: [],
    unfollowedAssessorsVisibility: false,
  },
  getters: {

    linkAssessmentsBySources: (state, getters, rootState, rootGetters) =>
      (accuracyStatus, sources) => {
        const authUserId = rootGetters['auth/user'].id

        let sourcesIds
        if (sources === 'trusted')
          sourcesIds = rootGetters['relatedSources/trustedIds'].concat(authUserId)
        else if (sources === 'followed')
          sourcesIds = rootGetters['relatedSources/followedIds'].concat(authUserId)

        return state.assessments[accuracyStatus].map(assessment => assessment.lastVersion.SourceId).filter(sourceId =>
          sourcesIds.includes(sourceId))
      },

    isConfirmed: (state, getters) => {
      const confirmedByTrusted = getters.linkAssessmentsBySources('confirmed', 'trusted')
      const refutedByTrusted = getters.linkAssessmentsBySources('refuted', 'trusted')

      console.log('confirmed by trusted', confirmedByTrusted)
      console.log('refuted by trusted', refutedByTrusted)

      if (confirmedByTrusted.length || refutedByTrusted.length) {
        return confirmedByTrusted.length && !(refutedByTrusted.length)
      }
      else {
        const confirmedByFollowed = getters.linkAssessmentsBySources('confirmed', 'followed')
        const refutedByFollowed = getters.linkAssessmentsBySources('refuted', 'followed')

        console.log('confirmed by followed', confirmedByFollowed)
        console.log('refuted by followed', refutedByFollowed)

        return confirmedByFollowed.length && !(refutedByFollowed.length)
      }
    },
    isRefuted: (state, getters) => {
      const confirmedByTrusted = getters.linkAssessmentsBySources('confirmed', 'trusted')
      const refutedByTrusted = getters.linkAssessmentsBySources('refuted', 'trusted')

      if (confirmedByTrusted.length || refutedByTrusted.length) {
        return !(confirmedByTrusted.length) && refutedByTrusted.length
      }
      else {
        const confirmedByFollowed = getters.linkAssessmentsBySources('confirmed', 'followed')
        const refutedByFollowed = getters.linkAssessmentsBySources('refuted', 'followed')
        return !(confirmedByFollowed.length) && refutedByFollowed.length
      }
    },
    isDebated: (state, getters) => {
      const confirmedByTrusted = getters.linkAssessmentsBySources('confirmed', 'trusted')
      const refutedByTrusted = getters.linkAssessmentsBySources('refuted', 'trusted')

      if (confirmedByTrusted.length || refutedByTrusted.length) {
        return confirmedByTrusted.length && refutedByTrusted.length
      }
      else {
        const confirmedByFollowed = getters.linkAssessmentsBySources('confirmed', 'followed')
        const refutedByFollowed = getters.linkAssessmentsBySources('refuted', 'followed')
        return confirmedByFollowed.length && refutedByFollowed.length
      }
    },
    /*
        determines if there are assessments by a source other than the original poster of the content
        */
    isNoSourceAssessmentNonEmpty(state, getters, rootState, rootGetter) {
      const postOwnerAssessmentCount = Object.values(state.postOwnerAssessment).length ? 1 : 0 // either 1 or 0;
      return Object.values(state.assessments).flat().length - postOwnerAssessmentCount
    },
  },
  mutations: {
    set_visibility(state, visibility) {
      state.isExpanded = visibility
    },
    set_expander_visibility(state, visibility) {
      state.expanderIsDisplayed = visibility
    },
    clear_assessments(state) {
      state.assessments = { confirmed: [], refuted: [], questioned: [] }
      state.userAssessment = {}
      state.postOwnerAssessment = {}
      state.unfollowedAssessorsOnPage = []
      state.unfollowedAssessorsVisibility = false
    },
    set_assessments(state, assessments) {
      state.assessments = assessments
    },
    prepend_assessments(state, payload) {
      state.assessments[payload.credibility].unshift(payload.assessment)
    },
    set_user_assessment(state, assessment) {
      state.userAssessment = assessment
    },
    set_article_poster_assessment(state, assessment) {
      state.postOwnerAssessment = assessment
    },
    set_unfollowed_assessors_on_page(state, assessors) {
      state.unfollowedAssessorsOnPage = assessors
    },
    set_unfollowed_assessors_visibility(state, visibility) {
      state.unfollowedAssessorsVisibility = visibility
    },
    remove_unfollowed_assessor(state, id) {
      const index = state.unfollowedAssessorsOnPage.map(el => el.id).indexOf(id)
      state.unfollowedAssessorsOnPage.splice(index, 1)
    },
  },
  actions: {

    getUnfollowedAssessors: (context) => {
      return new Promise((resolve, reject) => {
        const pageUrl = context.rootState.pageDetails.url

        browser.runtime.sendMessage({
          type: 'get_unfollowed_assessors',
          data: {
            headers: {
              urls: JSON.stringify([utils.extractHostname(pageUrl)]),
            },
          },
        })
          .then((assessors) => {
            if (assessors.length) {
              context.commit('set_unfollowed_assessors_on_page', assessors)
              context.dispatch('setUnfollowedAssessorsVisibility', true)
                .then(() => {
                  context.dispatch('setVisibility', true)
                    .then(() => {
                      resolve()
                    })
                })
            }
          })
          .catch((err) => {
            reject(err)
          })
      })
    },

    /*
        get assessments either from all sources that the auth user should see assessments and questions
        from or from specified usernames.
        */
    getPageAssessments: (context, payload) => {
      return new Promise((resolve, reject) => {
        const pageUrl = context.rootState.pageDetails.url
        const headers = {
          urls: JSON.stringify([utils.extractHostname(pageUrl)]),
        }

        if (payload && payload.usernames)
          headers.usernames = JSON.stringify(payload.usernames)

        Promise.all([browser.runtime.sendMessage({
          type: 'get_assessments',
          data: {
            headers,
          },
        }),
        /*
                for getting questions posted by the people who trust the auth user and have either
                specified the auth user as an arbiter of a question or have specified no one
                */
        browser.runtime.sendMessage({
          type: 'get_questions',
          data: {
            headers,
          },
        })])
          .then(([postsWAssessments, postsWQuestions]) => {
            let returnedAssessments = postsWAssessments.length ? postsWAssessments[0].PostAssessments : []
            const returnedQuestions = postsWQuestions.length ? postsWQuestions[0].PostAssessments : []
            returnedAssessments = returnedAssessments.concat(returnedQuestions)

            if (!(payload && payload.usernames)) {
              const userId = context.rootGetters['auth/user'].id
              const userAssessmentArr = returnedAssessments.filter(el => el.version === 1 && el.SourceId === userId)
              if (userAssessmentArr.length)
                context.commit('set_user_assessment', userAssessmentArr[0])
            }

            const post = postsWAssessments.length ? postsWAssessments[0] : postsWQuestions.length ? postsWQuestions[0] : null
            if (post) {
              const articlePoster = post.SourceId
              const articlePosterAssessmentArr = returnedAssessments.filter(assessment => assessment.SourceId === articlePoster)
              if (articlePosterAssessmentArr.length)
                context.commit('set_article_poster_assessment', articlePosterAssessmentArr[0])
            }

            if (returnedAssessments.length && !context.rootState.pageDetails.articleId)
              context.dispatch('pageDetails/getArticleByUrl', true, { root: true })

            context.dispatch('restructureAssessments', returnedAssessments)
              .then((restructuredAssessments) => {
                console.log('restructured assessments', restructuredAssessments)

                if (payload && payload.usernames) {
                  for (const key in restructuredAssessments) {
                    if (restructuredAssessments[key].length) {
                      context.commit('prepend_assessments', {
                        credibility: key,
                        assessment: restructuredAssessments[key][0],
                      })
                      context.dispatch('logAssessmentsViewing', { postId: post.id })
                      resolve()
                    }
                  }
                }
                else {
                  context.dispatch('sortAssessments', restructuredAssessments)
                    .then((sortedAssessments) => {
                      console.log('what are sorted assessments', sortedAssessments)
                      context.commit('set_assessments', sortedAssessments)

                      if (context.rootGetters['assessments/isNoSourceAssessmentNonEmpty'])
                        context.commit('set_visibility', true)

                      if (returnedAssessments.length)
                        context.dispatch('logAssessmentsViewing', { postId: post.id })

                      resolve()
                    })
                }
              })
          })
          .catch((err) => {
            console.log(err)
            reject(err)
          })
      })
    },

    restructureAssessments: (context, returnedAssessments) => {
      return new Promise((resolve, reject) => {
        const tmpAssessments = { confirmed: [], refuted: [], questioned: [] }
        const assessmentsBySource = {}

        returnedAssessments.forEach((returnedAssessment) => {
          if (returnedAssessment.SourceId === null) {
            if (returnedAssessment.version === 1) {
              const assessmentsObj = { lastVersion: returnedAssessment, assessor: {} }
              const credValue = utils.getAccuracyMapping(assessmentsObj.lastVersion.postCredibility)
              tmpAssessments[credValue].push(assessmentsObj)
            }
          }
          else {
            if (!(returnedAssessment.SourceId in assessmentsBySource)) {
              const assessmentsObj = {}
              assessmentsObj.history = []
              assessmentsBySource[returnedAssessment.SourceId] = assessmentsObj
            }

            if (returnedAssessment.version === 1)
              assessmentsBySource[returnedAssessment.SourceId].lastVersion = returnedAssessment
            else
              assessmentsBySource[returnedAssessment.SourceId].history.push(returnedAssessment)
          }
        })

        /*
                If an earlier version of a question had not been anonymous but the more recent ones are,
                this case can happen that assessmentsBySource[sourceId] for that SourceId can have a history
                property but not lastVersion. We remove this (the earlier versions) from the assessments.
                */
        for (const sourceId in assessmentsBySource) {
          if (!('lastVersion' in assessmentsBySource[sourceId]))
            delete assessmentsBySource[sourceId]
        }

        const sourcePromises = []

        for (const [SourceId, assessmentsObj] of Object.entries(assessmentsBySource)) {
          const credValue = utils.getAccuracyMapping(assessmentsObj.lastVersion.postCredibility)
          sourcePromises.push(
            sourceServices.getSourceById(SourceId)
              .then((response) => {
                assessmentsBySource[SourceId].assessor = response.data
                tmpAssessments[credValue].push(assessmentsObj)
              }),
          )
        }

        Promise.all(sourcePromises)
          .then(() => {
            resolve(tmpAssessments)
          })
      })
    },

    sortAssessments: (context, assessments) => {
      return new Promise((resolve, reject) => {
        const sortedAssessments = {}

        for (const [key, value] of Object.entries(assessments))
          sortedAssessments[key] = assessments[key].slice().sort(utils.compareAssessments)

        resolve(sortedAssessments)
      })
    },

    postAuthUserAssessment: (context, payload) => {
      const pageUrl = context.rootState.pageDetails.url
      return new Promise((resolve, reject) => {
        browser.runtime.sendMessage({
          type: 'post_assessment',
          data: {
            reqBody: {
              url: pageUrl,
              ...payload,
            },
          },
        })
          .then(() => {
            console.log('posted assessment', payload)
            resolve()
          })
          .catch((err) => {
            reject(err)
          })
      })
    },

    logAssessmentsViewing: (context, payload) => {
      return new Promise((resolve, reject) => {
        const pageUrl = context.rootState.pageDetails.url

        browser.runtime.sendMessage({
          type: 'log_interaction',
          interaction: {
            type: 'page_assessments',
            data: {
              pageURL: pageUrl,
              pageFullURL: window.location.href,
              assessments: JSON.stringify(context.state.assessments),
              postId: payload.postId,
            },
          },
        })
          .then(() => {
            resolve()
          })
      })
    },

    removeUserFromUnfollowedAssessors: (context, payload) => {
      context.commit('remove_unfollowed_assessor', payload)
    },

    setVisibility: (context, payload) => {
      context.commit('set_visibility', payload)
    },

    setExpanderVisibility: (context, payload) => {
      context.commit('set_expander_visibility', payload)
    },

    setHistoryVisibility: (context, payload) => {
      context.commit('set_history_visibility', payload)
    },

    populateAssessmentHistory: (context, payload) => {
      context.commit('populate_assessment_history', payload)
    },

    setUnfollowedAssessorsVisibility: (context, payload) => {
      context.commit('set_unfollowed_assessors_visibility', payload)
    },

    clearAssessments: (context, payload) => {
      context.commit('clear_assessments', payload)
    },
  },
}
