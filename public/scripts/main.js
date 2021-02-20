/**
 * @fileoverview
 * Provides the JavaScript interactions for all pages.
 *
 * @author 
 * hurtigna
 */


/** namespace. */
var pc = pc || {};

/** globals */
pc.fBAuthManager = null
pc.fBGroupPageManager = null
pc.fBDecisionsPageManager = null
pc.fBOptionPageManager = null
pc.fBInboxPageManager = null
pc.FB_GROUP_COLLECTION = `groups`
pc.FB_KEY_LAST_TOUCHED = "lastTouched"
pc.FB_GROUP_OWNER = "owner"
pc.FB_GROUP_MEMBERS = "members"
pc.FB_DISPLAY_NAME = "displayName"
pc.FB_USER_COLLECTION = "users"
pc.FB_MESSAGE_COLLECTION = "messages"
pc.FB_MESSAGE_FROM = "from"
pc.FB_MESSAGE_IS_REQUEST = "isRequest"
pc.FB_MESSAGE_COLLECTION = "groupID"
pc.FB_DECISION_COLLECTION = "decisions"
pc.FB_DECISION_OWNER = "owner"
pc.FB_OPTION_OWNER = "owner"
pc.FB_OPTION_COLLECTION = "options"
pc.FB_LAST_WENT = "lastWent"
pc.FB_USER_RANKINGS = "userRankings"
pc.storage = pc.storage || {}
pc.storage.GROUP_ID_KEY = `groupID`
pc.storage.DECISION_ID_KEY = `decisionID`
pc.storage.OPTION_ID_KEY = `optionID`

//Drag and drop
pc.allowOptionDrop = (event) => {
	event.preventDefault()
}
pc.dragOption = (event) => {
	event.dataTransfer.setData("optionID", event.target.id.substr(1))
}
pc.dropOption = (event) => {
	event.preventDefault()
	pc.fBOptionPageManager.setRank(pc.findRank(event.target), event.dataTransfer.getData("optionID"))
}

pc.findRank = (element) => {
	const rank = element.querySelector(".rank")
	if (rank) {
		return parseInt(rank.textContent)
	} else {
		return pc.findRank(element.parentElement)
	}
}

// From https://stackoverflow.com/questions/494143/creating-a-new-dom-element-from-an-html-string-using-built-in-dom-methods-or-pro
function htmlToElement(html) {
	var template = document.createElement('template');
	html = html.trim(); // Never return a text node of whitespace as the result
	template.innerHTML = html;
	return template.content.firstChild;
}
pc.RegisterPageController = class {
	constructor() {
		document.querySelector(`#registerDisplayName`).focus()
		document.querySelector(`#backButton`).onclick = () => {
			window.location.href = `/`
		}
		document.querySelector(`#registerButton`).onclick = (event) => {
			pc.fBAuthManager.createEmail(document.querySelector(`#registerDisplayName`).value, document.querySelector(`#registerEmail`).value, document.querySelector(`#registerPassword`).value)
		}
	}
}
pc.LogInPageController = class {
	constructor() {
		document.querySelector(`#logInEmail`).focus()
		document.querySelector(`#logInButton`).onclick = (event) => {
			pc.fBAuthManager.signInEmail(document.querySelector(`#logInEmail`).value, document.querySelector(`#logInPassword`).value)
		}
		document.querySelector(`#registerButton`).onclick = (event) => {
			window.location.href = "/register.html"
		}
	}
}
pc.FBAuthManager = class {
	constructor() {
		this._failedAttempts = 0
		this._user = null
		this.beginListening(() => {
			if (!this.signedIn) {
				if (!document.querySelector(`#logInPageContainer`) && !document.querySelector("#registerPageContainer")) {
					window.location.href = `/`
				}
			} else {
				if (document.querySelector(`#logInPageContainer`)) {
					window.location.href = `/groups.html`
				}
			}
			pc.setUpClasses()
		})
	}
	beginListening(changeListener) {
		firebase.auth().onAuthStateChanged((user) => {
			this._user = user
			changeListener()
		})
	}
	signInEmail(email, password) {
		firebase.auth().signInWithEmailAndPassword(email, password)
			.then(() => {
				window.location.href = "/groups.html"
			})
			.catch((error) => {
				if (error.code === "auth/invalid-email") {
					alert("Please enter a valid email.")
				} else if (error.code === "auth/user-not-found") {
					if (confirm("User not found. Would you like to register?")) {
						window.location.href = "register.html"
					}
				} else if (error.code === "auth/too-many-requests") {
					if (confirm(`Too many attempts! You can try again later or reset your password. Would you like to be sent a reset email to ${email}?`)) {
						firebase.auth().sendPasswordResetEmail(email)
					}
				} else if (error.code === "auth/wrong-password") {
					this._failedAttempts++
					if (this._failedAttempts >= 3) {
						if (confirm(`Incorrect password. Would you like to be sent a reset email to ${email}?`)) {
							firebase.auth().sendPasswordResetEmail(email)
						}
					} else {
						alert("Incorrect password.")
					}
				} else {
					console.log(error);
				}
			});
	}
	createEmail(displayName, email, password) {
		if (!displayName) {
			alert("Enter a display name.")
			return
		}
		firebase.auth().createUserWithEmailAndPassword(email, password)
			.then((userCred) => {
				firebase.firestore().collection(pc.FB_USER_COLLECTION).doc(userCred.user.email).set({
						[pc.FB_DISPLAY_NAME]: displayName
					})
					.then(() => {
						window.location.href = "/groups.html"
					})
					.catch((error) => console.log(`error: ${error.code} ${error.message}`))
			})
			.catch((error) => {
				if (error.code === "auth/invalid-email") {
					alert("Please enter a valid email.")
				} else if (error.code === "auth/weak-password") {
					alert("Password is weak.")
				} else if (error.code === "auth/email-already-in-use") {
					if (confirm("Email already in use. Would you like to sign in?")) {
						window.location.href = "index.html"
					}
				} else {
					console.log(error);
				}
			});
	}
	signOut() {
		firebase.auth().signOut().then(() => {}).catch((error) => {
			console.log(`sign out error`);
		});
	}
	get signedIn() {
		return !!this._user
	}
	get uid() {
		if (this.signedIn) {
			return this._user.email
		} else {
			return null
		}
	}
}
pc.Group = class {
	constructor(id, owner, name, members) {
		this.id = `_${id}`
		this.owner = `_${owner}`
		this.name = name
		this.members = members
	}
}
pc.GroupPageController = class {
	constructor() {
		pc.fBGroupPageManager.beginListening(this.updateList.bind(this))
		//set up modals
		document.querySelector("#submitCreateGroup").onclick = (event) => {
			pc.fBGroupPageManager.create(document.querySelector("#groupCreateName").value)
		}
		$("#createGroupModal").on("show.bs.modal", (event) => {
			document.querySelector("#groupCreateName").value = ``
		})
		$("#createGroupModal").on("shown.bs.modal", (event) => {
			document.querySelector("#groupCreateName").focus();
		})
		$("#editGroupModal").on("show.bs.modal", (event) => {
			document.querySelector("#groupEditName").value = ''
			firebase.firestore().collection(pc.FB_GROUP_COLLECTION).doc(sessionStorage.getItem(pc.storage.GROUP_ID_KEY)).get().then((group) => {
				document.querySelector("#groupEditName").value = group.data()[pc.FB_DISPLAY_NAME]
			})
		})
		$("#editGroupModal").on("shown.bs.modal", (event) => {
			document.querySelector("#groupEditName").focus();
			document.querySelector("#groupEditName").value = document.querySelector("#groupEditName").value
		})
		$("#inviteMemberModal").on("show.bs.modal", (event) => {
			document.querySelector("#inviteMemberName").value = ``
		})
		$("#inviteMemberModal").on("shown.bs.modal", (event) => {
			document.querySelector("#inviteMemberName").focus();
		})
		//set up listeners
		document.querySelector(`#submitCreateGroup`).onclick = (event) => {
			pc.fBGroupPageManager.create(document.querySelector("#groupCreateName").value)
		}
		document.querySelector(`#submitEditGroup`).onclick = (event) => {
			pc.fBGroupPageManager.updateName(document.querySelector("#groupEditName").value, sessionStorage.getItem(pc.storage.GROUP_ID_KEY))
		}
		document.querySelector('#submitInviteMember').onclick = (event) => {
			pc.fBGroupPageManager.sendInvite(document.querySelector("#inviteMemberName").value)
		}
	}
	updateList() {
		//Make a new container
		const newList = htmlToElement('<div class="container" id="groupCardContainer"><\div>')

		//Fill it
		if (pc.fBGroupPageManager.length > 0) {
			for (let i = 0; i < pc.fBGroupPageManager.length; i++) {
				newList.appendChild(this._createGroupCard(pc.fBGroupPageManager.getGroupAtIndex(i)))
			}
		} else {
			newList.innerHTML = `<h2 class="background-text">Looks like you aren't part of any groups yet... Find or create one using the
            buttons below!</h2>`
		}
		//Replace
		const oldList = document.querySelector("#groupCardContainer");
		oldList.parentElement.appendChild(newList);
		oldList.remove()
		this._fillMembers()
	}
	_fillMembers() {
		for (let i = 0; i < pc.fBGroupPageManager.length; i++) {
			const group = pc.fBGroupPageManager.getGroupAtIndex(i)
			let memberString = ``
			let promise = new Promise((resolve, reject) => {
				let membersLeft = group.members.length;
				for (let j = 0; j < group.members.length; j++) {
					firebase.firestore().collection(pc.FB_USER_COLLECTION).doc(group.members[j]).get().then((doc) => {
						if (group.members[j] != pc.fBAuthManager.uid) {
							memberString = `${memberString}, ${doc.get(pc.FB_DISPLAY_NAME)}`
						}
						membersLeft--
						if (membersLeft === 0) {
							//last iteration
							memberString = memberString.substr(2)
							if (!memberString) {
								memberString = ``
							}
							resolve()
						}
					})
				}
			})
			promise.then(() => {
				document.getElementById(group.id).firstElementChild.firstElementChild.lastElementChild.innerHTML = memberString
				this._enableGroupButtons(group.id)
			})
		}
	}

	_enableGroupButtons(groupID) {
		document.querySelectorAll(`#${groupID} .btn-restricted`).forEach((btn) => {
			if (btn.classList.contains(`_${pc.fBAuthManager.uid}`)) {
				btn.removeAttribute(`hidden`)
			}
		})
		document.querySelector(`#${groupID} .editGroup`).onclick = () => {
			sessionStorage.setItem(pc.storage.GROUP_ID_KEY, groupID.substr(1))
		}
		document.querySelector(`#${groupID} .inviteToGroup`).onclick = () => {
			sessionStorage.setItem(pc.storage.GROUP_ID_KEY, groupID.substr(1))
		}
		document.getElementById(groupID).removeAttribute(`hidden`)
	}

	_createGroupCard(group) {
		const newCard = htmlToElement(`<div hidden class="card" id="${group.id}">
		<div class="card-body row no-gutters">
			<div class="col-8 clickable">
          <h5 class="card-title" tabindex="-1">
			${group.name}
          </h5>
          <h6 class="card-subtitle mb-2 text-muted dot-dot-dot" tabindex="-1">
		  </h6>
		  </div>
		  <div class="btn-container col-4"><btn data-toggle="modal" data-target="#editGroupModal" hidden class="clickable editGroup btn-restricted ${group.owner} btn-right"><i class="material-icons">edit</i></btn>
		  <btn data-toggle="modal" data-target="#inviteMemberModal" class="clickable inviteToGroup btn-right"><i class="material-icons">person_add_alt_1</i></btn></div>
        </div>
	  </div>`);
		newCard.firstElementChild.firstElementChild.onclick = () => {
			window.location.href = `/decisions.html?id=${group.id}`
		}
		return newCard;
	}
}
pc.FBGroupPageManager = class {
	constructor() {
		this._documentSnapshots = [];
		this._ref = firebase.firestore().collection(pc.FB_GROUP_COLLECTION)
	}
	beginListening(changeListener) {
		this._unsubscribe = this._ref.limit(30).orderBy(pc.FB_KEY_LAST_TOUCHED, "desc").where(pc.FB_GROUP_MEMBERS, "array-contains", pc.fBAuthManager.uid).onSnapshot((querySnapshot) => {
			this._documentSnapshots = querySnapshot.docs
			changeListener()
		})
	}
	stopListening() {
		this._unsubscribe()
	}
	create(groupName) {
		if (groupName) {
			this._ref.add({
				[pc.FB_DISPLAY_NAME]: groupName,
				[pc.FB_GROUP_OWNER]: pc.fBAuthManager.uid,
				[pc.FB_GROUP_MEMBERS]: [pc.fBAuthManager.uid],
				[pc.FB_KEY_LAST_TOUCHED]: firebase.firestore.Timestamp.now(),
			}).catch((error) => {
				console.log(`Error creating group: ${error}`);
			})
		} else {
			alert("Please enter a group name.")
		}
	}
	updateName(newName, groupID) {
		if (newName && groupID) {
			this._ref.doc(groupID).update({
				[pc.FB_DISPLAY_NAME]: newName,
				[pc.FB_KEY_LAST_TOUCHED]: firebase.firestore.Timestamp.now(),
			})
		}
	}
	sendInvite(email) {
		if (email) {
			firebase.firestore().collection(pc.FB_USER_COLLECTION).doc(email).collection(pc.FB_MESSAGE_COLLECTION).add({
				[pc.FB_MESSAGE_FROM]: pc.fBAuthManager.uid,
				[pc.FB_MESSAGE_COLLECTION]: sessionStorage.getItem(pc.storage.GROUP_ID_KEY),
				[pc.FB_MESSAGE_IS_REQUEST]: false
			})
		} else {
			alert("Please enter an email.")
		}
	}
	get length() {
		return this._documentSnapshots.length
	}
	getGroupAtIndex(index) {
		const doc = this._documentSnapshots[index]
		return new pc.Group(doc.id, doc.get(pc.FB_GROUP_OWNER), doc.get(pc.FB_DISPLAY_NAME), doc.get(pc.FB_GROUP_MEMBERS))
	}
}
pc.FBMenuManager = class {
	constructor() {
		this._uid = pc.fBAuthManager.uid
		this._documentSnapshots = [];
		this._ref = firebase.firestore().collection(pc.FB_GROUP_COLLECTION)
		this._messageRef = firebase.firestore().collection(pc.FB_USER_COLLECTION).doc(this._uid).collection(pc.FB_MESSAGE_COLLECTION)
	}
	beginListening(changeListener) {
		this._unsubscribe = this._ref.limit(30).orderBy(pc.FB_KEY_LAST_TOUCHED, "desc").where(pc.FB_GROUP_MEMBERS, "array-contains", this._uid).onSnapshot((querySnapshot) => {
			this._documentSnapshots = querySnapshot.docs
			changeListener()
		})
		this._unsubscribeMessages = this._messageRef.limit(15).onSnapshot(() => {
			changeListener()
		})
	}
	stopListening() {
		this._unsubscribe()
		this._unsubscribeMessages()
	}
	get length() {
		return this._documentSnapshots.length
	}
	getGroupAtIndex(index) {
		const doc = this._documentSnapshots[index]
		return new pc.Group(doc.id, doc.get(pc.FB_GROUP_OWNER), doc.get(pc.FB_DISPLAY_NAME), doc.get(pc.FB_GROUP_MEMBERS))
	}
}
pc.Decision = class {
	constructor(id, name, owner, groupOwner) {
		this.id = `_${id}`
		this.name = name
		this.owner = `_${owner}`
		this.groupOwner = `_${groupOwner}`
	}
}
pc.DecisionsPageController = class {
	constructor() {
		pc.fBDecisionsPageManager.beginListening(this.updateList.bind(this))
		firebase.firestore().collection(pc.FB_GROUP_COLLECTION).doc(pc.fBDecisionsPageManager.groupID).get().then((doc) => {
			const name = doc.data()[pc.FB_DISPLAY_NAME]
			document.querySelector("#mainTitle").textContent = name
			document.querySelector("#leftTitle").textContent = name
		})
		document.querySelector("#submitLeaveGroup").onclick = () => {
			pc.fBDecisionsPageManager.leaveGroup()
		}
		document.querySelector("#submitDeleteGroup").onclick = () => {
			pc.fBDecisionsPageManager.deleteGroup()
		}
		document.querySelector("#submitCreateDecision").onclick = () => {
			pc.fBDecisionsPageManager.create(document.querySelector("#decisionCreateName").value)
		}
		$("#createDecisionModal").on("show.bs.modal", () => {
			document.querySelector("#decisionCreateName").value = ``
		})
		$("#createDecisionModal").on("shown.bs.modal", () => {
			document.querySelector("#decisionCreateName").focus();
		})
		$("#editDecisionModal").on("show.bs.modal", () => {
			document.querySelector("#decisionEditName").value = ''
			firebase.firestore().collection(pc.FB_GROUP_COLLECTION).doc(sessionStorage.getItem(pc.storage.GROUP_ID_KEY)).collection(pc.FB_DECISION_COLLECTION).doc(sessionStorage.getItem(pc.storage.DECISION_ID_KEY)).get().then((decision) => {
				document.querySelector("#decisionEditName").value = decision.data()[pc.FB_DISPLAY_NAME]
			})
		})
		$("#editDecisionModal").on("shown.bs.modal", () => {
			document.querySelector("#decisionEditName").focus();
			document.querySelector("#decisionEditName").value = document.querySelector("#decisionEditName").value
		})
		//set up listeners
		document.querySelector(`#submitCreateDecision`).onclick = () => {
			pc.fBDecisionsPageManager.create(document.querySelector("#decisionCreateName").value)
		}
		document.querySelector(`#submitEditDecision`).onclick = () => {
			pc.fBDecisionsPageManager.updateName(document.querySelector("#decisionEditName").value, sessionStorage.getItem(pc.storage.DECISION_ID_KEY))
		}
		document.querySelector(`#submitDeleteDecision`).onclick = () => {
			pc.fBDecisionsPageManager.delete(sessionStorage.getItem(pc.storage.DECISION_ID_KEY))
		}
	}
	updateList() {
		//Make a new container
		const newList = htmlToElement('<div class="container" id="decisionCardContainer"><\div>')

		//Fill it
		if (pc.fBDecisionsPageManager.length > 0) {
			for (let i = 0; i < pc.fBDecisionsPageManager.length; i++) {
				newList.appendChild(this._createDecisionCard(pc.fBDecisionsPageManager.getDecisionAtIndex(i)))
			}
		} else {
			newList.innerHTML = `<h2 class="background-text">Looks like there aren't any decisions yet... Create one using the button below!</h2>`
		}
		//Replace
		const oldList = document.querySelector("#decisionCardContainer");
		oldList.parentElement.appendChild(newList);
		oldList.remove()
	}
	_createDecisionCard(decision) {
		const newCard = htmlToElement(`<div hidden class="card" id="${decision.id}">
		<div class="card-body row no-gutters">
			<div class="col-8 clickable">
          <h5 class="card-title" tabindex="-1">
			${decision.name}
          </h5>
          <h6 class="card-subtitle mb-2 text-muted dot-dot-dot">
		  </h6>
		  </div>
		  <div class="btn-container col-4"><btn data-toggle="modal" data-target="#editDecisionModal" hidden class="clickable editDecision btn-restricted ${decision.owner} ${decision.groupOwner} btn-right"><i class="material-icons">edit</i></btn>
		  </div>
        </div>
	  </div>`);
		newCard.firstElementChild.firstElementChild.onclick = () => {
			window.location.href = `/options.html?gid=${new URLSearchParams(window.location.search).get(`id`)}&id=${decision.id}`
		}
		this._enableDecisionButtons(newCard)
		return newCard;
	}
	_enableDecisionButtons(card) {
		card.querySelectorAll(`.btn-restricted`).forEach((btn) => {
			if (btn.classList.contains(`_${pc.fBAuthManager.uid}`)) {
				btn.removeAttribute(`hidden`)
			}
		})
		card.querySelector(`.editDecision`).onclick = () => {
			sessionStorage.setItem(pc.storage.GROUP_ID_KEY, pc.fBDecisionsPageManager.groupID)
			sessionStorage.setItem(pc.storage.DECISION_ID_KEY, card.id.substr(1))
		}
		card.removeAttribute(`hidden`)
	}
}
pc.FBDecisionsPageManager = class {
	constructor(groupID) {
		this._documentSnapshots = [];
		this._groupSnapshot = null
		this._id = groupID
		this._groupRef = firebase.firestore().collection(pc.FB_GROUP_COLLECTION).doc(groupID)
		this._ref = firebase.firestore().collection(pc.FB_GROUP_COLLECTION).doc(groupID).collection(pc.FB_DECISION_COLLECTION)
	}
	beginListening(changeListener) {
		this._unsubscribeGroup = this._groupRef.onSnapshot((doc) => {
			if (doc.exists) {
				this._groupSnapshot = doc
			} else {
				setTimeout(() => window.location.href = "groups.html", 1000)
			}
		})
		this._unsubscribe = this._ref.limit(30).orderBy(pc.FB_LAST_WENT, "desc").onSnapshot((querySnapshot) => {
			this._documentSnapshots = querySnapshot.docs
			changeListener()
		})
	}
	stopListening() {
		this._unsubscribe()
		this._unsubscribeGroup()
	}
	create(decisionName) {
		if (decisionName) {
			this._ref.add({
				[pc.FB_DISPLAY_NAME]: decisionName,
				[pc.FB_DECISION_OWNER]: pc.fBAuthManager.uid,
				[pc.FB_LAST_WENT]: firebase.firestore.Timestamp.now(),
			}).catch((error) => {
				console.log(`Error creating decision: ${error}`);
			})
		} else {
			alert("Please enter a decision name.")
		}
	}
	updateName(newName, decisionID) {
		if (newName && decisionID) {
			this._ref.doc(decisionID).update({
				[pc.FB_DISPLAY_NAME]: newName
			})
		}
	}
	delete(decisionID) {
		this._ref.doc(decisionID).delete()
	}
	leaveGroup() {
		firebase.firestore().collection(pc.FB_GROUP_COLLECTION).doc(this._id).update({
			[pc.FB_GROUP_MEMBERS]: firebase.firestore.FieldValue.arrayRemove(pc.fBAuthManager.uid)
		}).then(() => {
			console.log("done leaving");
			window.location.href = "/groups.html"
		})
	}
	deleteGroup() {
		firebase.firestore().collection(pc.FB_GROUP_COLLECTION).doc(this._id).delete().then(() => {
			console.log("done deleting");
			window.location.href = "/groups.html"
		})
	}
	get length() {
		return this._documentSnapshots.length
	}
	getDecisionAtIndex(index) {
		const doc = this._documentSnapshots[index]
		return new pc.Decision(doc.id, doc.get(pc.FB_DISPLAY_NAME), doc.get(pc.FB_DECISION_OWNER), this._groupSnapshot.get(pc.FB_GROUP_OWNER))
	}
	get groupID() {
		return this._id
	}
}
pc.Option = class {
	constructor(id, name, rank, owner, decisionOwner, groupOwner) {
		this.id = `_${id}`
		this.rank = rank
		this.name = name
		this.owner = `_${owner}`
		this.decisionOwner = `_${decisionOwner}`
		this.groupOwner = `_${groupOwner}`
	}
}
pc.OptionPageController = class {
	constructor() {
		//Set up navigation
		const search = new URLSearchParams(window.location.search)
		const backURL = `/decisions.html?id=${search.get(`gid`)}`
		document.querySelector("#leftTitle").href = backURL
		document.querySelector("#backButton").href = backURL
		firebase.firestore().collection(pc.FB_GROUP_COLLECTION).doc(search.get("gid").substr(1)).collection(pc.FB_DECISION_COLLECTION).doc(search.get("id").substr(1)).get().then((doc) => {
			const name = doc.get(pc.FB_DISPLAY_NAME)
			document.querySelector("#mainTitle").textContent = name
			document.querySelector("#leftTitle").textContent = name
		})
		pc.fBOptionPageManager.beginListening(this.updateList.bind((this)))
		document.querySelector("#submitCreateOption").onclick = () => {
			pc.fBOptionPageManager.create(document.querySelector("#optionCreateName").value)
		}
		$("#createOptionModal").on("show.bs.modal", () => {
			document.querySelector("#optionCreateName").value = ``
		})
		$("#createOptionModal").on("shown.bs.modal", () => {
			document.querySelector("#optionCreateName").focus();
		})
		$("#editOptionModal").on("show.bs.modal", () => {
			document.querySelector("#optionEditName").value = ''
			firebase.firestore().collection(pc.FB_GROUP_COLLECTION).doc(sessionStorage.getItem(pc.storage.GROUP_ID_KEY)).collection(pc.FB_DECISION_COLLECTION)
				.doc(sessionStorage.getItem(pc.storage.DECISION_ID_KEY)).collection(pc.FB_OPTION_COLLECTION)
				.doc(sessionStorage.getItem(pc.storage.OPTION_ID_KEY)).get().then((option) => {
					document.querySelector("#optionEditName").value = option.data()[pc.FB_DISPLAY_NAME]
				})
		})
		$("#editOptionModal").on("shown.bs.modal", () => {
			document.querySelector("#optionEditName").focus();
			document.querySelector("#optionEditName").value = document.querySelector("#optionEditName").value
		})
		$("#updateRankModal").on("show.bs.modal", () => {
			document.querySelector("#updateRankName").value = ""
		})
		$("#updateRankModal").on("shown.bs.modal", () => {
			document.querySelector("#updateRankName").focus()
		})
		//set up listeners
		document.querySelector(`#submitCreateOption`).onclick = () => {
			pc.fBOptionPageManager.create(document.querySelector("#optionCreateName").value)
		}
		document.querySelector(`#submitEditOption`).onclick = () => {
			pc.fBOptionPageManager.updateName(document.querySelector("#optionEditName").value, sessionStorage.getItem(pc.storage.OPTION_ID_KEY))
		}
		document.querySelector(`#submitDeleteOption`).onclick = () => {
			pc.fBOptionPageManager.delete(sessionStorage.getItem(pc.storage.OPTION_ID_KEY))
		}
		document.querySelector("#submitDeleteGroup").onclick = () => {
			pc.fBOptionPageManager.deleteGroup()
		}
		document.querySelector("#submitUpdateRank").onclick = () => {
			pc.fBOptionPageManager.setRank(parseInt(document.querySelector("#updateRankName").value), sessionStorage.getItem(pc.storage.OPTION_ID_KEY))
		}
		document.querySelector(`#personalRank`).onclick = () => {
			document.querySelector(`#personalRank`).classList.add('secondary')
			document.querySelector(`#groupRank`).classList.remove('secondary')
			pc.fBOptionPageManager.switchToPersonal(this.updateList.bind(this))
		}
		document.querySelector(`#groupRank`).onclick = () => {
			document.querySelector(`#personalRank`).classList.remove('secondary')
			document.querySelector(`#groupRank`).classList.add('secondary')
			pc.fBOptionPageManager.switchToGroup(this.updateList.bind(this))
		}
	}
	updateList() {
		//Make a new container
		const isGroup = pc.fBOptionPageManager.isGroupView
		const newList = htmlToElement('<div class="container" id="optionCardContainer"><\div>')
		//Fill it
		if (pc.fBOptionPageManager.length > 0) {
			document.querySelector("#updateRankName").max = pc.fBOptionPageManager.length
			for (let i = 0; i < pc.fBOptionPageManager.length; i++) {
				newList.appendChild(this._createOptionCard(pc.fBOptionPageManager.getOptionAtIndex(i), isGroup, i == 0, i == pc.fBOptionPageManager.length - 1))
			}
		} else {
			newList.innerHTML = `<h2 class="background-text">Looks like there aren't any options yet... Create one using the button below!</h2>`
		}
		//Replace
		const oldList = document.querySelector("#optionCardContainer");
		oldList.parentElement.appendChild(newList);
		oldList.remove()
	}
	_createOptionCard(option, isGroup, topOption, bottomOption) {
		let htmlString = `
		<div hidden class="card" id="${option.id}" draggable="true" ondragstart="pc.dragOption(event)" ondrop="pc.dropOption(event)" ondragover="pc.allowOptionDrop(event)">
			<div class="card-body row no-gutters">
			<div data-toggle="modal" data-target="#updateRankModal" class="col-8 clickable align-items-center changeRank" style="display: flex">
				<h5 class="rank no-margin">${option.rank}</h5>
         		<h5 class="card-title no-margin">${option.name}</h5>
		  	</div>
		  <div class="btn-container col-4">
		  	<btn data-toggle="modal" data-target="#editOptionModal" hidden class="clickable editOption btn-restricted ${option.owner} ${option.decisionOwner} ${option.groupOwner} btn-right">
				<i class="material-icons">edit</i>
			</btn>`
		if (!isGroup) {
			htmlString += `
			<btn type="button" class="downButton btn-right" tabindex="-1"><i class="material-icons dark-gray">expand_more</i></btn>
			<btn type="button" class="upButton btn-right" tabindex="-1"><i class="material-icons dark-gray">expand_less</i></btn>`
		}
		htmlString += `
			</div>
        	</div>
	 	</div>`
		const newCard = htmlToElement(htmlString);
		if (!isGroup) {
			if (topOption) {
				newCard.querySelector(".upButton").firstElementChild.style.color = "#AAA"
			} else {
				newCard.querySelector(".upButton").onclick = () => {
					pc.fBOptionPageManager.clickUp(option.id)
				}
			}
			if (bottomOption) {
				newCard.querySelector(".downButton").firstElementChild.style.color = "#AAA"
			} else {
				newCard.querySelector(".downButton").onclick = () => {
					pc.fBOptionPageManager.clickDown(option.id)
				}
			}
		}
		this._enableOptionButtons(newCard)
		return newCard;
	}
	_enableOptionButtons(card) {
		card.querySelectorAll(`.btn-restricted`).forEach((btn) => {
			if (btn.classList.contains(`_${pc.fBAuthManager.uid}`)) {
				btn.removeAttribute(`hidden`)
			}
		})
		card.querySelector(`.editOption`).onclick = () => {
			sessionStorage.setItem(pc.storage.GROUP_ID_KEY, pc.fBOptionPageManager.groupID)
			sessionStorage.setItem(pc.storage.DECISION_ID_KEY, pc.fBOptionPageManager.decisionID)
			sessionStorage.setItem(pc.storage.OPTION_ID_KEY, card.id.substr(1))
		}
		card.querySelector('.changeRank').onclick = () => {
			sessionStorage.setItem(pc.storage.GROUP_ID_KEY, pc.fBOptionPageManager.groupID)
			sessionStorage.setItem(pc.storage.DECISION_ID_KEY, pc.fBOptionPageManager.decisionID)
			sessionStorage.setItem(pc.storage.OPTION_ID_KEY, card.id.substr(1))
		}
		card.removeAttribute(`hidden`)
	}
}
pc.FBOptionPageManager = class {
	constructor(groupID, decisionID) {
		this.groupID = groupID
		this.decisionID = decisionID
		this._groupRef = firebase.firestore().collection(pc.FB_GROUP_COLLECTION).doc(groupID)
		this._groupSnapshot = null
		this._decisionRef = this._groupRef.collection(pc.FB_DECISION_COLLECTION).doc(decisionID)
		this._decisionSnapshot = null
		this._ref = this._decisionRef.collection(pc.FB_OPTION_COLLECTION)
		this._documentSnapshots = []
		this.isGroupView = false;
	}
	beginListening(changeListener) {
		this._unsubscribeDecision = this._decisionRef.onSnapshot(doc => {
			if (doc.exists) {
				this._decisionSnapshot = doc
			} else {
				window.location.href = `decisions.html?id=${this._groupSnapshot.id}`
			}
		})
		this._unsubscribeGroup = this._groupRef.onSnapshot((doc) => {
			if (doc.exists) {
				this._groupSnapshot = doc
			} else {
				setTimeout(() => window.location.href = "groups.html", 1000)
			}
		})
		this._unsubscribe = this._ref.limit(30).orderBy(pc.FB_LAST_WENT, "desc").onSnapshot((querySnapshot) => {
			const id = pc.fBAuthManager.uid.replace(".", "%2E")
			let nextRank = 1
			let unassigned
			for (let doc of querySnapshot.docs) {
				//if doc doesn't have the field for my UID, update it in FB.
				if (doc.get(pc.FB_USER_RANKINGS)[id]) {
					nextRank++
				} else {
					if (!unassigned) {
						unassigned = doc
					}
				}
			}
			if (unassigned) {
				this._setSingle(unassigned.id, id, nextRank)
				//Will make a new snapshot because ref is updated
				return
			}
			//If we made it this far, all options are updated
			this._documentSnapshots = querySnapshot.docs
			//sort with respect to rank
			this._documentSnapshots.sort((a, b) => {
				return a.get(pc.FB_USER_RANKINGS)[id] - b.get(pc.FB_USER_RANKINGS)[id]
			})
			setTimeout(changeListener, 80)
		})
	}
	switchToGroup(changeListener) {
		if (this.isGroupView) {
			return
		}
		this.isGroupView = true
		this._unsubscribe = this._ref.limit(30).orderBy(pc.FB_LAST_WENT, "desc").onSnapshot((querySnapshot) => {
			const id = pc.fBAuthManager.uid.replace(".", "%2E")
			let nextRank = 1
			let unassigned
			for (let doc of querySnapshot.docs) {
				//if doc doesn't have the field for my UID, update it in FB.
				if (doc.get(pc.FB_USER_RANKINGS)[id]) {
					nextRank++
				} else {
					if (!unassigned) {
						unassigned = doc
					}
				}
			}
			if (unassigned) {
				this._setSingle(unassigned.id, id, nextRank)
				//Will make a new snapshot because ref is updated
				return
			}
			//If we made it this far, all options are updated
			this._documentSnapshots = querySnapshot.docs

			//Different group things now!
			const buffer = this._documentSnapshots.length
			for (let doc of this._documentSnapshots) {
				let sum = 0
				for (let rank of Object.values(doc.get(pc.FB_USER_RANKINGS))) {
					sum += buffer - rank
				}
				doc.goodness = sum
			}
			this._documentSnapshots.sort((a, b) => {
				if (b.goodness - a.goodness == 0) {
					//whatever is oldest is first
					return a.get(pc.FB_LAST_WENT) - b.get(pc.FB_LAST_WENT)
				}
				return b.goodness - a.goodness
			})
			setTimeout(changeListener, 80)
		})
	}
	switchToPersonal(changeListener) {
		if (!this.isGroupView) {
			return
		}
		this.isGroupView = false
		this._unsubscribe = this._ref.limit(30).orderBy(pc.FB_LAST_WENT, "desc").onSnapshot((querySnapshot) => {
			const id = pc.fBAuthManager.uid.replace(".", "%2E")
			let nextRank = 1
			let unassigned
			for (let doc of querySnapshot.docs) {
				//if doc doesn't have the field for my UID, update it in FB.
				if (doc.get(pc.FB_USER_RANKINGS)[id]) {
					nextRank++
				} else {
					if (!unassigned) {
						unassigned = doc
					}
				}
			}
			if (unassigned) {
				this._setSingle(unassigned.id, id, nextRank)
				//Will make a new snapshot because ref is updated
				return
			}
			//If we made it this far, all options are updated
			this._documentSnapshots = querySnapshot.docs
			//sort with respect to rank
			this._documentSnapshots.sort((a, b) => {
				return a.get(pc.FB_USER_RANKINGS)[id] - b.get(pc.FB_USER_RANKINGS)[id]
			})
			setTimeout(changeListener, 80)
		})
	}
	stopListening() {
		this._unsubscribe()
		this._unsubscribeDecision()
		this._unsubscribeGroup()
	}
	create(optionName) {
		if (optionName) {
			this._demoteAll(1, pc.fBAuthManager.uid)
			this._ref.add({
				[pc.FB_DISPLAY_NAME]: optionName,
				[pc.FB_OPTION_OWNER]: pc.fBAuthManager.uid,
				[pc.FB_USER_RANKINGS]: {
					[pc.fBAuthManager.uid.replace(".", "%2E")]: 1
				},
				[pc.FB_LAST_WENT]: firebase.firestore.Timestamp.now(),
			}).catch((error) => {
				console.log(`Error creating option: ${error}`);
			})
		} else {
			alert("Please enter an option name.")
		}
	}
	updateName(newName, optionID) {
		this._ref.doc(optionID).update({
			[pc.FB_DISPLAY_NAME]: newName
		})
	}
	delete(optionID) {
		this._ref.doc(optionID).get().then((doc) => {
			for (let id of this._groupSnapshot.get(pc.FB_GROUP_MEMBERS)) {
				this._promoteAll(doc.get(pc.FB_USER_RANKINGS)[id.replace(".", "%2E")], id.replace(".", "%2E"))
			}
			this._ref.doc(optionID).delete()
		})
	}
	setRank(rank, optionID) {
		if (rank < 1 || rank > this.length) {
			alert(`You can only rank options from 1 to ${this.length}!`)
			return
		}
		const uid = pc.fBAuthManager.uid.replace(".", "%2E")
		let option
		for (let doc of this._documentSnapshots) {
			if (doc.id == optionID) {
				option = doc;
				break
			}
		}
		const oldRank = option.get(pc.FB_USER_RANKINGS)[uid]
		if (oldRank == rank) {
			return
		}
		if (oldRank < rank) {
			//I was moved down (my rank got bigger). Gotta promote those that I bubbled. Started at the rank below (1 bigger than) my old rank, ends at my new rank.
			this._promoteRange(oldRank + 1, rank, uid)
		} else {
			//I got moved up. Gotta demote those that I bubbled.
			this._demoteRange(rank, oldRank - 1, uid)
		}
		this._setSingle(option.id, uid, rank)
	}
	clickDown(optionID) {
		optionID = optionID.substr(1)
		const uid = pc.fBAuthManager.uid
		//find clicked option
		let clicked
		for (let doc of this._documentSnapshots) {
			if (doc.id == optionID) {
				clicked = doc
				break
			}
		}
		const below = clicked.get(pc.FB_USER_RANKINGS)[uid.replace(".", "%2E")] + 1
		for (let doc of this._documentSnapshots) {
			//is this directly below the clicked one?
			if (doc.get(pc.FB_USER_RANKINGS)[uid.replace(".", "%2E")] == below) {
				this._setSingle(doc.id, uid, below - 1)
				this._setSingle(clicked.id, uid, below)
				return
			}
		}
	}
	clickUp(optionID) {
		optionID = optionID.substr(1)
		const uid = pc.fBAuthManager.uid
		//find clicked option
		let clicked
		for (let doc of this._documentSnapshots) {
			if (doc.id == optionID) {
				clicked = doc
				break
			}
		}
		const above = clicked.get(pc.FB_USER_RANKINGS)[uid.replace(".", "%2E")] - 1
		for (let doc of this._documentSnapshots) {
			//is this directly above the clicked one?
			if (doc.get(pc.FB_USER_RANKINGS)[uid.replace(".", "%2E")] == above) {
				this._setSingle(doc.id, uid, above + 1)
				this._setSingle(clicked.id, uid, above)
				return
			}
		}
	}
	deleteGroup() {
		console.log(this.groupID);
		console.log("working");
		firebase.firestore().collection(pc.FB_GROUP_COLLECTION).doc(this.groupID).delete().then(() => {
			console.log(this.groupID);
			console.log("done");
		}).catch((error) => {
			console.error(error);
		})
	}
	_promoteRange(start, end, id) {
		for (let doc of this._documentSnapshots) {
			const currentRank = doc.get(pc.FB_USER_RANKINGS)[id.replace(".", "%2E")]
			if (currentRank >= start && currentRank <= end) {
				this._setSingle(doc.id, id, currentRank - 1)
			}
		}
	}
	_demoteRange(start, end, id) {
		for (let doc of this._documentSnapshots) {
			const currentRank = doc.get(pc.FB_USER_RANKINGS)[id.replace(".", "%2E")]
			if (currentRank >= start && currentRank <= end) {
				this._setSingle(doc.id, id, currentRank + 1)
			}
		}
	}
	_promoteAll(rank, id) {
		for (let doc of this._documentSnapshots) {
			const currentRank = doc.get(pc.FB_USER_RANKINGS)[id.replace(".", "%2E")]
			if (currentRank >= rank) {
				this._setSingle(doc.id, id, currentRank - 1)
			}
		}
	}
	_demoteAll(rank, id) {
		for (let doc of this._documentSnapshots) {
			const currentRank = doc.get(pc.FB_USER_RANKINGS)[id.replace(".", "%2E")]
			if (currentRank >= rank) {
				this._setSingle(doc.id, id, currentRank + 1)
			}
		}
	}
	_setSingle(optionID, userID, newVal) {
		userID = userID.replace(".", "%2E")
		const field = `${pc.FB_USER_RANKINGS}.${userID}`
		this._ref.doc(optionID).update({
			[field]: newVal
		}).catch((error) => {})
	}
	get length() {
		return this._documentSnapshots.length
	}
	getOptionAtIndex(index) {
		const option = this._documentSnapshots[index]
		return new pc.Option(option.id, option.get(pc.FB_DISPLAY_NAME), option.get(pc.FB_USER_RANKINGS)[pc.fBAuthManager.uid.replace(".", "%2E")], option.get(pc.FB_DECISION_OWNER), this._decisionSnapshot.get(pc.FB_DECISION_OWNER), this._groupSnapshot.get(pc.FB_GROUP_OWNER))
	}
}
pc.Message = class {
	constructor(id, from, isRequest, groupID) {
		this.id = id
		this.from = from
		this.isRequest = isRequest
		this.groupID = groupID
	}
}
pc.InboxPageController = class {
	constructor() {
		pc.fBInboxPageManager.beginListening(this.updateList.bind(this))
	}
	updateList() {
		//Make a new container
		const newList = htmlToElement('<div class="container" id="inboxCardContainer"><\div>')

		//Fill it with hidden cards
		if (pc.fBInboxPageManager.length > 0) {
			for (let i = 0; i < pc.fBInboxPageManager.length; i++) {
				const group = pc.fBInboxPageManager.getMessageAtIndex(i)
				newList.appendChild(this._createMessageCard(pc.fBInboxPageManager.getMessageAtIndex(i)))
			}
		} else {
			newList.innerHTML = `<h2 class="background-text">No messages yet!</h2>`
		}
		//Replace
		const oldList = document.querySelector("#inboxCardContainer");
		oldList.parentElement.appendChild(newList);
		oldList.remove()
		//Make cards visible after they get their message data
		this._fillData()
	}
	_createMessageCard(message) {
		let newCard;
		newCard = htmlToElement(`<div hidden class="card" id="${message.id}">
		<div class="card-body row no-gutters">
			<div class="col-8 clickable">
          <h5 class="card-title">
			REPLACE ME
          </h5>
		  <h6 class="card-subtitle mb-2 text-muted">
		  REPLACE ME
		  </h6>
		  </div>
		  <div class="btn-container col-4">
		  <btn class="clickable accept btn-right"><i class="material-icons">done</i></btn>
		  <btn class="clickable reject btn-right"><i class="material-icons">close</i></btn></div>
        </div>
		  </div>`)
		newCard.querySelector(".accept").onclick = (event) => {
			pc.fBInboxPageManager.acceptMessage(message)
		}
		newCard.querySelector(".reject").onclick = (event) => {
			pc.fBInboxPageManager.rejectMessage(message)
		}
		return newCard;
	}
	_fillData() {
		for (let i = 0; i < pc.fBInboxPageManager.length; i++) {
			const message = pc.fBInboxPageManager.getMessageAtIndex(i)
			firebase.firestore().collection(pc.FB_USER_COLLECTION).doc(message.from).get()
				.then((user) => firebase.firestore().collection(pc.FB_GROUP_COLLECTION).doc(message.groupID).get().then((group) => {
					const messageCard = document.getElementById(message.id)
					messageCard.querySelector(".card-title").innerHTML = user.data()[pc.FB_DISPLAY_NAME]
					if (message.isRequest) {
						messageCard.querySelector(".card-subtitle").innerHTML = `wants to join ${group.data()[pc.FB_DISPLAY_NAME]}`
					} else {
						messageCard.querySelector(".card-subtitle").innerHTML = `wants you to join ${group.data()[pc.FB_DISPLAY_NAME]}`
					}
					messageCard.removeAttribute(`hidden`)
				}))
		}
	}
}
pc.FBInboxPageManager = class {
	constructor() {
		this._documentSnapshots = [];
		this._ref = firebase.firestore().collection(pc.FB_USER_COLLECTION).doc(pc.fBAuthManager.uid).collection(pc.FB_MESSAGE_COLLECTION)
	}
	beginListening(changeListener) {
		this._unsubscribe = this._ref.limit(30).onSnapshot((querySnapshot) => {
			this._documentSnapshots = querySnapshot.docs
			changeListener()
		})
	}
	stopListening() {
		this._unsubscribe()
	}
	acceptMessage(message) {
		if (!message.isRequest) {
			firebase.firestore().collection(pc.FB_GROUP_COLLECTION).doc(message.groupID).update({
				[pc.FB_GROUP_MEMBERS]: firebase.firestore.FieldValue.arrayUnion(pc.fBAuthManager.uid)
			}).then(this._ref.doc(message.id).delete()).catch((err) => {
				console.error("Error updating group members!");
				console.error(err);
			})
		}
	}
	rejectMessage(message) {
		this._ref.doc(message.id).delete()
	}
	delete(id) {
		this._ref.doc(id).delete().catch((error) => {
			console.log(`error deleting doc: ${error}`);
		})
	}
	get length() {
		return this._documentSnapshots.length
	}
	getMessageAtIndex(index) {
		const doc = this._documentSnapshots[index]
		return new pc.Message(doc.id, doc.get(pc.FB_MESSAGE_FROM), doc.get(pc.FB_MESSAGE_IS_REQUEST), doc.get(pc.FB_MESSAGE_COLLECTION))
	}
}
/* Main */
pc.main = function () {
	pc.fBAuthManager = new pc.FBAuthManager()
};
pc.setUpClasses = function () {
	if (document.querySelector("#logInPageContainer")) {
		new pc.LogInPageController()
	} else if (document.querySelector("#registerPageContainer")) {
		new pc.RegisterPageController()
	} else if (document.querySelector("#groupsContainer")) {
		pc.fBGroupPageManager = new pc.FBGroupPageManager()
		new pc.GroupPageController(pc.fBAuthManager.uid)
	} else if (document.querySelector(`#decisionsContainer`)) {
		const groupID = new URLSearchParams(window.location.search).get(`id`).substr(1)
		if (groupID) {
			pc.fBDecisionsPageManager = new pc.FBDecisionsPageManager(groupID)
		} else {
			console.log("badURL");
			window.location.href = "/groups.html"
		}
		new pc.DecisionsPageController()
	} else if (document.querySelector(`#optionsContainer`)) {
		const search = new URLSearchParams(window.location.search)
		const groupID = search.get('gid').substr(1)
		const id = search.get('id').substr(1)
		if (!groupID || !id) {
			console.log("badURL");
			window.location.href = "/groups.html"
		}
		pc.fBOptionPageManager = new pc.FBOptionPageManager(groupID, id)
		new pc.OptionPageController()
	} else if (document.querySelector(`#inboxContainer`)) {
		pc.fBInboxPageManager = new pc.FBInboxPageManager()
		new pc.InboxPageController()
	}
	if (document.querySelector("#menuDrawer")) {
		pc.fBMenuManager = new pc.FBMenuManager()
		pc.fBMenuManager.beginListening(pc.updateMenuDrawer)
	}
}
pc.updateMenuDrawer = function () {
	//Make a new container
	const newList = htmlToElement('<div id="menuDrawer" class="bmd-layout-drawer bg-faded"><\div>')
	const decisions = !!document.querySelector("#decisionsContainer")
	const options = !!document.querySelector("#optionsContainer")
	//Fill it
	for (let i = 0; i < pc.fBMenuManager.length; i++) {
		if (i === 5) {
			break;
		}
		const group = pc.fBMenuManager.getGroupAtIndex(i)
		if (decisions) {
			if (pc.fBDecisionsPageManager.groupID == group.id.substr(1)) {
				continue;
			}

		} else if (options) {
			if (pc.fBOptionPageManager.groupID == group.id.substr(1)) {
				continue;
			}
		}
		newList.appendChild(createGroupCard(pc.fBMenuManager.getGroupAtIndex(i)))
	}
	if (document.querySelector("#decisionsContainer") || document.querySelector("#optionsContainer")) {
		//Make leave group button
		const leaveCard = htmlToElement(`
		<div class="menuCard col-10">
		
			<div data-toggle="modal" data-target="#leaveGroupModal" class="clickable leaveGroup" style="display: flex">
			<i class="material-icons" style="color: #222222; flex: 0 1 auto">directions_run</i><h5 style="flex: 0 1 auto">
			&nbsp;Leave Group
			</h5>
        	</div>
	  	</div>`);
		newList.appendChild(leaveCard)
		//Make delete group button
		const deleteCard = htmlToElement(`
		<div hidden class="menuCard col-10">
			<div data-toggle="modal" data-target="#deleteGroupModal" class="clickable deleteGroup" style="display: flex">
			<i class="material-icons" style="color: #222222; flex: 0 1 auto">delete</i><h5 style="flex: 0 1 auto">
			&nbsp;Delete Group
			</h5>
        	</div>
	  	</div>`);
		newList.appendChild(deleteCard)
		let groupID
		if (document.querySelector("#optionsContainer")) {
			groupID = pc.fBOptionPageManager.groupID
		} else {
			groupID = pc.fBDecisionsPageManager.groupID
		}
		firebase.firestore().collection(pc.FB_GROUP_COLLECTION).doc(groupID).get().then((doc) => {
			if (doc.data()[pc.FB_GROUP_OWNER] == pc.fBAuthManager.uid) {
				leaveCard.setAttribute('hidden', 'true')
				deleteCard.removeAttribute('hidden')
			}
		})
	}
	//Make inbox card
	const inboxCard = htmlToElement(`
		<div class="menuCard col-10">
			<div class="clickable" style="display: flex">
			<i id="inbox" class="material-icons" style="color: #222222; flex: 0 1 auto">email</i><h5 style="flex: 0 1 auto">
			&nbsp;Inbox
			</h5>
        	</div>
	  	</div>`);
	inboxCard.firstElementChild.onclick = (event) => {
		window.location.href = `/inbox.html`
	}
	newList.appendChild(inboxCard)
	//check to see if messages
	firebase.firestore().collection(pc.FB_USER_COLLECTION).doc(pc.fBAuthManager.uid).collection(pc.FB_MESSAGE_COLLECTION).get().then((messages) => {
		if (!messages.empty) {
			document.querySelector("#inbox").innerHTML = "mark_email_unread"
		}
	})
	//Make settings card
	// const settingsCard = htmlToElement(`
	// 	<div class="menuCard col-10">
	// 		<div class="clickable" style="display: flex">
	// 		<i class="material-icons" style="color: #222222; flex: 0 1 auto">settings</i><h5 style="flex: 0 1 auto">
	// 		&nbsp;Settings
	// 		</h5>
	//     	</div>
	//   	</div>`);
	// settingsCard.firstElementChild.onclick = (event) => {
	// 	window.location.href = `/settings.html`
	// }
	// newList.appendChild(settingsCard)
	//Make logout card
	const logoutCard = htmlToElement(`
		<div class="menuCard col-10">
			<div class="clickable" style="display: flex">
			<i class="material-icons" style="color: #222222; flex: 0 1 auto">logout</i><h5 style="flex: 0 1 auto">
			&nbsp;Log Out
			</h5>
        	</div>
	  	</div>`);
	logoutCard.firstElementChild.onclick = (event) => {
		pc.fBAuthManager.signOut()
	}
	newList.appendChild(logoutCard)
	//Replace
	const oldList = document.querySelector("#menuDrawer");
	oldList.parentElement.appendChild(newList);
	oldList.remove()
	//"<btn data-toggle="modal" data-target="#leaveGroupModal" class="clickable leaveGroup btn-right"><i class="material-icons">HE DIDNT LIKE LOGIN</i></btn>"
	function createGroupCard(group) {
		const newCard = htmlToElement(`
		<div class="menuCard col-10">
			<h5 class="clickable">
				${group.name}
        	</h5>
	  	</div>`);
		newCard.firstElementChild.onclick = (event) => {
			window.location.href = `/decisions.html?id=${group.id}`
		}
		return newCard;
	}
}
pc.main();