
class Event {
  constructor(type, title, start, end){
    this.type = type
    this.title = title
    this.start = moment(start)
    if(!end)
      this.end = this.start.clone().add(30, "minutes")
    else
      this.end = end;
    this.weekday = moment.weekdays(this.start.day())
  }

  startsBetween(startTime, endTime){
    return moment().isBetween(startTime, endTime);
  }

  duration(){
    return this.end.diff(this.start)
  }

  durationInMinutes(){
    return moment.duration(this.duration()).asMinutes()
  }
}

const EventsFromConversation = function(me, conv, duration){
  let ps = conv.participants.filter(p => {
    let userIds = p.sessions[0].segments[0].requestedRoutingUserIds
    return p.purpose == "acd" && userIds && userIds[0] == me.id
  })
  let events = [];
  ps.forEach( p => {
    let queueId = p.sessions[0].segments[0].queueId;
    let title = p.sessions[0].callbackUserName;
    let startTime = p.sessions[0].callbackScheduledTime;
    events.push(new Event("callback", title, startTime))
  })
  return events;
}

var app = new Vue({
  el: '#app',
  data: {
    globalStart: "08:00",
    globalEnd: "18:00",
    timeslot: 30,
    timeSlots: [],
    weekdays: ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"],
    eventMap: {},
    days: [
      {
        name: "Lundi",
        events: [{
          start: "",
          duration: ""
        }]
      }
    ],
    events: []
  },
  computed: {
    // List des timeslots sur la journée
    timeSlotsInDay(){
      return [...new Set(this.timeSlots.map(timeslot => timeslot.timeslot))]
    }
  },
  methods: {
  },
  created() {
    moment.locale('fr')
    // De lundi à vendredi
    this.weekdays = moment.weekdays(true).splice(0,5)

    // Je trouve le moment du début de la semaine
    this.startMoment = moment().startOf('isoWeek');
    this.startMomentAnalytics = moment().add(-30, 'days');

    // Définir le moment du début
    this.momentStart = this.startMomentAnalytics.clone().set({hours: this.globalStart.split(":")[0], minutes: this.globalStart.split(":")[1], seconds: 0})

    const platformClient = require('platformClient');
    var client = platformClient.ApiClient.instance;
    client.setEnvironment('mypurecloud.ie');
    client.setPersistSettings(true);
    // Login
    client.loginImplicitGrant("a5a5a1e0-c12d-xxxxx", "https://hostname/index.html")
      .then(data => {
        console.log(data);
        // Utiliser la session de l'utilisateur
        platformClient.ApiClient.instance.authentications['PureCloud Auth'].accessToken = data.accessToken;

        var me = null;

        // Lit les information sur l'utilisateur de la session
        var users = new platformClient.UsersApi();
        users.getUsersMe()
        .then(userData => {
          me = userData;

          // Obtient tous les callbacks planifiés
          var analytics = new platformClient.AnalyticsApi();
          var body = {
            "interval": `${this.momentStart.toISOString()}/${moment().toISOString()}`,
            "order": "asc",
            "orderBy": "conversationStart",
            "paging": {
              "pageSize": "100",
              "pageNumber": 1
            },
            "segmentFilters": [
              {
                "type": "and",
                "clauses": [
                  {
                    "type": "or",
                    "predicates": [
                      {
                        "type": "dimension",
                        "dimension": "mediaType",
                        "operator": "matches",
                        "value": "callback"
                      }
                    ]
                  },
                  {
                    "type": "and",
                    "predicates": [
                      {
                        "type": "dimension",
                        "dimension": "segmentType",
                        "operator": "matches",
                        "value": "scheduled"
                      }
                    ]
                  }
                ]
              }
            ]
          }
          return analytics.postAnalyticsConversationsDetailsQuery(body)
        })
        .then(data => {
          myCallbacks = [];

          // Si j'ai trouvé des callbacks
          if(data && data.conversations){
            // Filtrer les callbacks pour ne conserver que ceux de l'utilisateur
            myCallbacks = data.conversations.filter(conv => {
              // Le filtre s'applique sur les conversations où le userId de l'utilisateur de la session est indiqué et que le rappel n'est pas terminé'
              return conv.participants.find(p => {
                let userIds = p.sessions[0].segments[0].requestedRoutingUserIds
                return p.purpose == "acd" && userIds && userIds[0] == me.id && !p.sessions[0].segments[0].disconnectType
              })
            })
            console.log(myCallbacks);
          }

          this.timeSlots = [];
          this.events = [];

          // Créé un event de 30min dans le calendrier pour chaque callback
          myCallbacks.forEach(cb => {
            this.events = this.events.concat(EventsFromConversation(me, cb))
          })


          // Fake events
          this.events.push(new Event("other", "Réunion", this.startMoment.clone().hours(9), this.startMoment.clone().hours(10)))
          this.events.push(new Event("other", "Téléphone", this.startMoment.clone().hours(11), this.startMoment.clone().hours(12)))
          this.events.push(new Event("other", "RDV M. Moreau", this.startMoment.clone().add(1, 'day').hours(9), this.startMoment.clone().add(1, 'day').hours(10).minutes(30)))
          this.events.push(new Event("other", "RDV M. Bernard", this.startMoment.clone().add(1, 'day').hours(14), this.startMoment.clone().add(1, 'day').hours(15).minutes(0)))
          this.events.push(new Event("other", "RDV Mme Martin", this.startMoment.clone().add(1, 'day').hours(16), this.startMoment.clone().add(1, 'day').hours(17).minutes(30)))
          this.events.push(new Event("other", "RDV M. Millan", this.startMoment.clone().add(2, 'day').hours(10), this.startMoment.clone().add(2, 'day').hours(11).minutes(0)))
          this.events.push(new Event("other", "Envoi de courrier", this.startMoment.clone().add(2, 'day').hours(14), this.startMoment.clone().add(2, 'day').hours(14).minutes(30)))
          this.events.push(new Event("other", "Dossier en cours", this.startMoment.clone().add(2, 'day').hours(15).minutes(30), this.startMoment.clone().add(2, 'day').hours(17).minutes(30)))
          this.events.push(new Event("other", "Visite agence", this.startMoment.clone().add(3, 'day').hours(17).minutes(0), this.startMoment.clone().add(3, 'day').hours(18).minutes(0)))

          // Créer une liste de créneaux de 30 min qui peuvent inclure ou pas des évènements (rendez-vous)
          for(let i=0; i<5; i++){
            let current = this.startMoment.clone().set({hours: this.globalStart.split(":")[0], minutes: this.globalStart.split(":")[1], seconds: 0})
            current.add(i, 'day');
            let momentEnd = current.clone().set({hours: this.globalEnd.split(":")[0], minutes: this.globalEnd.split(":")[0], seconds: 0})

            let currentWeekday = current.format("dddd");
            this.eventMap[currentWeekday] = {};

            while(momentEnd.isAfter(current)){
              let event = this.events.find(ev => ev.start.isBetween(current, current.clone().add(this.timeslot, "minutes"), null, "[)"));
              if(!event)
                event = new Event("empty", "", current, current.clone().add(this.timeslot, 'minutes'))

              let currentTime = current.format("HH:mm");
              this.eventMap[currentWeekday][currentTime] = [];
              let newTimeSlot = {
                day: current.format("dddd"),
                timeslot: current.format("HH:mm"),
                time: current,
                duration: 30,
                event: event
              }
              this.timeSlots.push(newTimeSlot);
              this.eventMap[currentWeekday][currentTime] = newTimeSlot;
              current = current.add(this.timeslot, "minutes");
            }
          }
        })
        .catch(err => {
          console.log('There was a failure calling postAnalyticsConversationsDetailsQuery');
          console.error(err);
        });
      })
      .catch(err => {
        // Handle failure response
        console.log(err);
      });

  }
})
