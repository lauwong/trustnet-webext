import Api from './api'

export default {
  getAssessmentsForURL(headers) {
    return Api().get('/posts/assessments/urls', {
      withCredentials: true,
      headers,
    })
  },

  postAssessmentForURL(reqBody) {
    return Api().post('/posts/assessments/url', reqBody,
      {
        withCredentials: true,
      })
  },

  getQuestionsForURL(headers) {
    return Api().get('/posts/questions/urls', {
      withCredentials: true,
      headers,
    })
  },

  followRedirects(headers) {
    return Api().get('/urls/follow-redirects', {
      withCredentials: true,
      headers,
    })
  },

  getRedirects(headers) {
    return Api().get('/urls/redirects', {
      withCredentials: true,
      headers,
    })
  },

  updateRedirects(reqBody) {
    return Api().post('/urls/redirects', reqBody,
      {
        withCredentials: true,
      })
  },

  scheduleRedirects(reqBody) {
    return Api().post('/urls/schedule-redirects', reqBody,
      {
        withCredentials: true,
      })
  },

  getAssessmentsAndQuestionsFromStrangers(headers) {
    return Api().get('/posts/unfollowed-assessors/urls', {
      withCredentials: true,
      headers,
    })
  },
}
