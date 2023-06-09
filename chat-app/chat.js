import * as Vue from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js'
import { mixin } from "https://mavue.mavo.io/mavue.js";
import GraffitiPlugin from 'https://graffiti.garden/graffiti-js/plugins/vue/plugin.js'
import Resolver from './resolver.js'

const app = {
  // Import MaVue
  mixins: [mixin],

  // Import resolver
  created() {
    this.resolver = new Resolver(this.$gf)
  },

  setup() {
    // Initialize the name of the channel we're chatting in
    const channel = Vue.ref('default')

    // And a flag for whether or not we're private-messaging
    const privateMessaging = Vue.ref(false)

    // If we're private messaging use "me" as the channel,
    // otherwise use the channel value
    const $gf = Vue.inject('graffiti')
    const context = Vue.computed(() => privateMessaging.value ? [$gf.me] : [channel.value])

    // Initialize the collection of messages associated with the context
    const { objects: messagesRaw } = $gf.useObjects(context)
    return { channel, privateMessaging, messagesRaw }
  },

  data() {
    // Initialize some more reactive variables
    return {
      messageText: '',
      editID: '',
      editText: '',
      recipient: '',
      //////////////////////////////
      // Problem 1 solution
      preferredUsername: '',
      usernameResult: '',
      //////////////////////////////
      //////////////////////////////
      // Problem 2 solution
      recipientUsername: '',
      recipientUsernameSearch: '',
      //////////////////////////////
      //////////////////////////////
      // Problem 3 solution
      myUsername: '',
      actorsToUsernames: {},
      /////////////////////////////
      imageDownloads: {},
      /////////////////////////////
      savedChannels: [
        "default",
        "default-demo",
        "test",
        "help",
        "newchannel",
      ],
      addingChannel: false,
      recoverChannel: '',
    }
  },

  //////////////////////////////
  // Problem 3 solution
  watch: {
    '$gf.me': async function (me) {
      this.myUsername = await this.resolver.actorToUsername(me)
    },

    async messages(messages) {
      for (const m of messages) {
        if (!(m.actor in this.actorsToUsernames)) {
          this.actorsToUsernames[m.actor] = await this.resolver.actorToUsername(m.actor)
        }
        if (m.bto && m.bto.length && !(m.bto[0] in this.actorsToUsernames)) {
          this.actorsToUsernames[m.bto[0]] = await this.resolver.actorToUsername(m.bto[0])
        }
      }
    },

    async messagesWithAttachments(messages) {
      for (const m of messages) {
        if (!(m.attachment.magnet in this.imageDownloads)) {
          let blob;
          try {
            blob = await this.$gf.media.fetch(m.attachment.magnet)
          } catch {
            this.imageDownloads[m.attachment.magnet] = false
            continue
          }
          this.imageDownloads[m.attachment.magnet] = URL.createObjectURL(blob)
        }
      }
    }
  },
  /////////////////////////////

  computed: {
    messages() {
      let messages = this.messagesRaw
        // Filter the "raw" messages for data
        // that is appropriate for our application
        // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-note
        .filter(m =>
          // Does the message have a type property?
          m.type &&
          // Is the value of that property 'Note'?
          m.type == 'Note' &&
          // Does the message have a content property?
          (m.content || m.content == '') &&
          // Is that property a string?
          typeof m.content == 'string')

      // Do some more filtering for private messaging
      if (this.privateMessaging) {
        messages = messages.filter(m =>
          // Is the message private?
          m.bto &&
          // Is the message to exactly one person?
          m.bto.length == 1 &&
          (
            // Is the message to the recipient?
            m.bto[0] == this.recipient ||
            // Or is the message from the recipient?
            m.actor == this.recipient
          ))
      }

      return messages
        // Sort the messages with the
        // most recently created ones first
        .sort((m1, m2) => new Date(m2.published) - new Date(m1.published))
        // Only show the 10 most recent ones
        .slice(0, 10)
    },

    messagesWithAttachments() {
      return this.messages.filter(m =>
        m.attachment &&
        m.attachment.type == 'Image' &&
        typeof m.attachment.magnet == 'string'
      )
    }
  },

  methods: {
    async sendMessage() {
      const message = {
        type: 'Note',
        content: this.messageText,
      }

      if (this.file) {
        message.attachment = {
          type: 'Image',
          magnet: await this.$gf.media.store(this.file)
        }
        this.file = null
      }

      // The context field declares which
      // channel(s) the object is posted in
      // You can post in more than one if you want!
      // The bto field makes messages private
      if (this.privateMessaging) {
        message.bto = [this.recipient]
        message.context = [this.$gf.me, this.recipient]
      } else {
        message.context = [this.channel]
      }

      // Send!
      this.$gf.post(message)
      this.messageText = ""
    },

    removeMessage(message) {
      this.$gf.remove(message)
    },

    startEditMessage(message) {
      // Mark which message we're editing
      this.editID = message.id
      // And copy over it's existing text
      this.editText = message.content
    },

    saveEditMessage(message) {
      // Save the text (which will automatically
      // sync with the server)
      message.content = this.editText
      // And clear the edit mark
      this.editID = ''
    },

    cancelEditMessage() {
      this.editID = ''
    },

    startAddChannel() {
      this.addingChannel = true;
      this.recoverChannel = this.channel;
    },

    addChannel() {
      this.savedChannels.push(this.channel);
      this.addingChannel = false;
    },

    cancelAddChannel() {
      this.channel = this.recoverChannel;
      this.addingChannel = false;
    },

    /////////////////////////////
    // Problem 1 solution
    async setUsername() {
      try {
        this.usernameResult = await this.resolver.requestUsername(this.preferredUsername)
        this.myUsername = this.preferredUsername
      } catch (e) {
        this.usernameResult = e.toString()
      }
    },
    /////////////////////////////

    /////////////////////////////
    // Problem 2 solution
    async chatWithUser() {
      this.recipient = await this.resolver.usernameToActor(this.recipientUsernameSearch)
      this.recipientUsername = this.recipientUsernameSearch
    },
    /////////////////////////////

    onImageAttachment(event) {
      const file = event.target.files[0]
      this.file = file
    },

    findMessage(id) {
      return this.messages.filter(m => m.id === id)[0];
    }
  }
}

const Name = {
  props: ['actor', 'editable'],

  setup(props) {
    // Get a collection of all objects associated with the actor
    const { actor } = Vue.toRefs(props)
    const $gf = Vue.inject('graffiti')
    return $gf.useObjects([actor])
  },

  computed: {
    profile() {
      return this.objects
        // Filter the raw objects for profile data
        // https://www.w3.org/TR/activitystreams-vocabulary/#dfn-profile
        .filter(m =>
          // Does the message have a type property?
          m.type &&
          // Is the value of that property 'Profile'?
          m.type == 'Profile' &&
          // Does the message have a name property?
          m.name &&
          // Is that property a string?
          typeof m.name == 'string')
        // Choose the most recent one or null if none exists
        .reduce((prev, curr) => !prev || curr.published > prev.published ? curr : prev, null)
    }
  },

  data() {
    return {
      editing: false,
      editText: ''
    }
  },

  methods: {
    editName() {
      this.editing = true
      // If we already have a profile,
      // initialize the edit text to our existing name
      this.editText = this.profile ? this.profile.name : this.editText
    },

    saveName() {
      if (this.profile) {
        // If we already have a profile, just change the name
        // (this will sync automatically)
        this.profile.name = this.editText
      } else {
        // Otherwise create a profile
        this.$gf.post({
          type: 'Profile',
          name: this.editText
        })
      }

      // Exit the editing state
      this.editing = false
    }
  },

  template: '#name'
}

const Like = {
  props: ["messageid"],

  data() {
    return {
      likeButtonActive: false,
    }
  },

  setup(props) {
    const $gf = Vue.inject('graffiti')
    const messageid = Vue.toRef(props, 'messageid')
    const { objects: likesRaw } = $gf.useObjects([messageid])
    return { likesRaw }
  },

  computed: {
    likes() {
      return this.likesRaw.filter(l =>
        l.type == 'Like' &&
        l.object == this.messageid)
    },

    numLikes() {
      // Unique number of actors
      return [...new Set(this.likes.map(l => l.actor))].length
    },

    myLikes() {
      return this.likes.filter(l => l.actor == this.$gf.me)
    }
  },

  methods: {
    toggleLike() {
      if (this.myLikes.length) {
        this.$gf.remove(...this.myLikes)
        this.likeButtonActive = false;
      } else {
        this.$gf.post({
          type: 'Like',
          object: this.messageid,
          context: [this.messageid]
        })
        this.likeButtonActive = true;
      }
    }
  },

  template: '#like'
}

const Read = {
  props: ["messageid"],

  data() {
    return ({
      actorsToUsernames: {},
    })
  },

  setup(props) {
    const $gf = Vue.inject('graffiti')
    const messageid = Vue.toRef(props, 'messageid')
    // const actorsToUsernames = Vue.toRef(props, 'actorstousernames')
    const { objects: readsRaw } = $gf.useObjects([messageid])
    return { readsRaw }
  },

  created() {
    // Import resolver
    this.resolver = new Resolver(this.$gf)
  },

  mounted() {
    if (!this.myReads.length) {
      this.$gf.post({
        type: 'Read',
        object: this.messageid,
        context: [this.messageid]
      });
    }
  },

  computed: {
    reads() {
      return this.readsRaw.filter(r =>
        r.type == 'Read' &&
        r.object == this.messageid)
    },

    whoRead() {
      // Unique number of actors
      return [...new Set(this.reads.map(r => this.actorsToUsernames[r.actor]))]
    },

    myReads() {
      return this.reads.filter(r => r.actor == this.$gf.me)
    }
  },

  watch: {
    async reads(reads) {
      for (const r of reads) {
        if (!(r.actor in this.actorsToUsernames)) {
          this.actorsToUsernames[r.actor] = await this.resolver.actorToUsername(r.actor)
        }
      }
    },
  },

  template: '#read'
}

const Reply = {
  props: ["messageid", "channel"],

  data() {
    return ({
      messageText: '',
      isReplying: false,
    })
  },

  setup(props) {
    const $gf = Vue.inject('graffiti')
    const messageid = Vue.toRef(props, 'messageid')
    const channel = Vue.toRef(props, 'channel')
  },

  methods: {
    startReplying() {
      this.isReplying = true;
    },

    cancelReplying() {
      this.isReplying = false;
      this.messageText = '';
    },

    async sendMessage() {
      this.$gf.post({
        type: 'Note',
        content: this.messageText,
        inReplyTo: this.messageid,
        context: [this.channel],
      });

      this.messageText = '';
      this.isReplying = false;
    },
  },

  template: '#reply'
}

const Profile = {
  props: ['actor', 'editable'],

  setup(props) {
    // Get a collection of all objects associated with the actor
    const { actor } = Vue.toRefs(props)
    const $gf = Vue.inject('graffiti')
    return $gf.useObjects([actor])
  },

  computed: {
    profile() {
      return this.objects
        .filter(m =>
          m.type &&
          m.type == 'Profile' &&
          m.icon &&
          m.icon.type == 'Image' &&
          m.icon.magnet
        )
        .reduce((prev, curr) => !prev || curr.published > prev.published ? curr : prev, null)
    }
  },

  data() {
    return {
      file: null,
      picture: undefined,
    }
  },

  methods: {
    onImageAttachment(event) {
      const file = event.target.files[0];
      this.file = file;
    },

    async changePicture() {
      if (this.profile) {
        this.profile.icon.magnet = await this.$gf.media.store(this.file);
      } else {
        this.$gf.post({
          type: 'Profile',
          icon: {
            type: "Image",
            magnet: await this.$gf.media.store(this.file),
          },
        });
      }
      this.file = null;
    },
  },

  watch: {
    async profile(profile) {
      let blob;
      try {
        blob = await this.$gf.media.fetch(profile.icon.magnet);
        this.picture = URL.createObjectURL(blob);
      } catch (error) {
        console.log(error);
        this.picture = null;
      }
    },
  },

  template: '#profile'
}

app.components = { Name, Like, Read, Reply, Profile }
Vue.createApp(app)
  .use(GraffitiPlugin(Vue))
  .mount('#app')
