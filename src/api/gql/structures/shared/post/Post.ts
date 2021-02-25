import {Field, ObjectType} from 'type-graphql';
import {User} from '~/api/gql/structures';
import {IPost} from '~/shared/types';

@ObjectType({description: 'Post'})
export class Post {
  constructor(post: IPost) {
    const {userId, createdAt, content, title} = post;
    this.userId = userId;
    this.createdAt = createdAt;
    this.content = content;
    this.title = title;
  }
  userId: number;

  @Field(() => User, {description: 'Post owner'})
  user: User;

  @Field(() => String, {description: 'Title'})
  title: string;

  @Field(() => String, {description: 'Content'})
  content: string;

  @Field(() => Date, {description: 'Creation date'})
  createdAt: Date;
}